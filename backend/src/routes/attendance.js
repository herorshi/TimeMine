import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { toDateStr, toDateTimeStr, lateMinutes } from '../lib/time.js'
import { getSettings } from '../lib/settings.js'
import { identify, isDescriptor, readPhoto } from '../lib/face.js'
import { saveImage, deleteImage } from '../lib/storage.js'
import { notifyAdmins } from '../lib/line.js'
import { distanceMeters, readLocation } from '../lib/geo.js'

const MODES = ['office', 'building', 'wfh']
const STATUSES = ['approved', 'pending', 'rejected']

const MODE_LABELS = { office: '🏢 Office', building: '🏬 Building', wfh: '🏠 WFH' }

function checkInMessage(user, row) {
  return [
    '🟢 เข้างาน',
    `${user.name} (${user.emp_code})${user.department ? ` · ${user.department}` : ''}`,
    `เวลา ${row.check_in_at.slice(11, 16)} น. · ${MODE_LABELS[row.mode]}`,
    row.late_minutes > 0 && `⚠️ สาย ${row.late_minutes} นาที`,
    row.mode === 'wfh' && 'รออนุมัติ',
    row.mode === 'building' && row.face_verified && '✅ ยืนยันใบหน้าแล้ว',
  ].filter(Boolean).join('\n')
}

const router = Router()
router.use(auth)

const byId = (id) => db.prepare('SELECT * FROM attendance WHERE id = ?').get(id)
const todayRow = (userId) => db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, toDateStr())

router.post('/check-in', async (req, res) => {
  const { mode, descriptor, note } = req.body || {}
  if (!MODES.includes(mode)) throw httpError(400, 'รูปแบบการเข้างานไม่ถูกต้อง')
  if (await todayRow(req.user.id)) throw httpError(400, 'วันนี้ลงเวลาเข้างานแล้ว')

  // geofence runs before any face match / photo save: an out-of-area attempt records nothing
  const settings = await getSettings()
  const location = readLocation(req.body)
  let locationDistance = null
  if (mode !== 'wfh' && settings.office_lat !== '' && settings.office_lng !== '') {
    if (!location) throw httpError(400, 'กรุณาเปิดการเข้าถึงตำแหน่งที่ตั้ง (Location) เพื่อลงเวลา')
    locationDistance = Math.round(distanceMeters(location.lat, location.lng, Number(settings.office_lat), Number(settings.office_lng)))
    const radius = Number(settings.office_radius_m)
    if (locationDistance > radius) throw httpError(400, `คุณอยู่นอกพื้นที่ตึก (ห่าง ${locationDistance} ม. เกินรัศมี ${radius} ม.)`)
  }

  let faceVerified = 0
  let faceDistance = null
  let facePhotoUrl = null
  if (mode === 'building') {
    if (!isDescriptor(descriptor)) throw httpError(400, 'กรุณาสแกนใบหน้า')
    const photo = readPhoto(req.body.photo)
    if (!req.user.face_descriptor) throw httpError(400, 'ยังไม่ได้ลงทะเบียนใบหน้า กรุณาติดต่อผู้ดูแลระบบ')
    const face = await identify(descriptor, { expectUserId: req.user.id, record: true })
    faceVerified = 1
    faceDistance = face.distance
    facePhotoUrl = await saveImage(photo, 'image/jpeg', `faces/checkin-${req.user.id}-${Date.now()}-${randomUUID()}`)
  }

  const now = new Date()
  const checkInAt = toDateTimeStr(now)
  // a concurrent check-in can pass the todayRow check above: UNIQUE (user_id, date) decides
  const info = await db.prepare(`INSERT INTO attendance (user_id, date, mode, check_in_at, status, late_minutes, face_verified, face_distance, face_photo_url, note, check_in_lat, check_in_lng, check_in_accuracy, location_distance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, date) DO NOTHING`).run(
    req.user.id, toDateStr(now), mode, checkInAt, mode === 'wfh' ? 'pending' : 'approved',
    lateMinutes(checkInAt, settings), faceVerified, faceDistance, facePhotoUrl, String(note || '').trim() || null,
    location?.lat ?? null, location?.lng ?? null, location?.accuracy ?? null, locationDistance,
  )
  if (!info.changes) {
    await deleteImage(facePhotoUrl)
    throw httpError(400, 'วันนี้ลงเวลาเข้างานแล้ว')
  }
  const row = await byId(info.lastInsertRowid)
  res.status(201).json(row)
  notifyAdmins(checkInMessage(req.user, row)) // fire-and-forget: never rejects
})

router.post('/check-out', async (req, res) => {
  const row = await todayRow(req.user.id)
  if (!row) throw httpError(400, 'วันนี้ยังไม่ได้ลงเวลาเข้างาน')
  if (row.status === 'rejected') throw httpError(400, 'รายการเข้างานวันนี้ไม่ได้รับอนุมัติ')
  if (row.check_out_at) throw httpError(400, 'วันนี้ลงเวลาออกงานแล้ว')
  const info = await db.prepare('UPDATE attendance SET check_out_at = ? WHERE id = ? AND check_out_at IS NULL').run(toDateTimeStr(), row.id)
  if (!info.changes) throw httpError(400, 'วันนี้ลงเวลาออกงานแล้ว')
  res.json(await byId(row.id))
})

router.get('/today', async (req, res) => res.json((await todayRow(req.user.id)) || null))

router.get('/me', async (req, res) => {
  const { from, to } = req.query
  const where = ['user_id = ?']
  const args = [req.user.id]
  if (from) { where.push('date >= ?'); args.push(String(from)) }
  if (to) { where.push('date <= ?'); args.push(String(to)) }
  res.json(await db.prepare(`SELECT * FROM attendance WHERE ${where.join(' AND ')} ORDER BY date DESC`).all(...args))
})

// count/minutes = all-time, month_* = the requested month; rejected records are not counted
router.get('/me/late-summary', async (req, res) => {
  const month = String(req.query.month || toDateStr().slice(0, 7))
  res.json(await db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(late_minutes),0) minutes,
      COUNT(CASE WHEN substr(date,1,7) = ? THEN 1 END) month_count,
      COALESCE(SUM(CASE WHEN substr(date,1,7) = ? THEN late_minutes END),0) month_minutes
    FROM attendance WHERE user_id = ? AND late_minutes > 0 AND status != 'rejected'`).get(month, month, req.user.id))
})

router.get('/', requireRole('admin'), async (req, res) => {
  const { date, status, mode } = req.query
  const where = []
  const args = []
  if (date) { where.push('a.date = ?'); args.push(String(date)) }
  if (STATUSES.includes(status)) { where.push('a.status = ?'); args.push(status) }
  if (MODES.includes(mode)) { where.push('a.mode = ?'); args.push(mode) }
  res.json(await db.prepare(`SELECT a.*, u.name, u.emp_code, u.department FROM attendance a JOIN users u ON u.id = a.user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.date DESC, a.check_in_at DESC LIMIT 500`).all(...args))
})

async function review(req, status, reason) {
  const row = await byId(req.params.id)
  if (!row) throw httpError(404, 'ไม่พบรายการ')
  if (row.mode !== 'wfh' || row.status !== 'pending') throw httpError(400, 'รายการนี้ไม่ได้รออนุมัติ')
  const info = await db.prepare("UPDATE attendance SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'")
    .run(status, reason, req.user.id, toDateTimeStr(), row.id)
  if (!info.changes) throw httpError(400, 'รายการนี้ไม่ได้รออนุมัติ')
  return byId(row.id)
}

router.post('/:id/approve', requireRole('admin'), async (req, res) => res.json(await review(req, 'approved', null)))

router.post('/:id/reject', requireRole('admin'), async (req, res) => {
  const reason = String(req.body?.reason || '').trim()
  if (!reason) throw httpError(400, 'กรุณาระบุเหตุผล')
  res.json(await review(req, 'rejected', reason))
})

export default router
