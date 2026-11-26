import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { toDateStr, toDateTimeStr, lateMinutes } from '../lib/time.js'
import { getSettings } from '../lib/settings.js'
import { verifyFace, isDescriptor } from '../lib/face.js'

const MODES = ['office', 'building', 'wfh']
const STATUSES = ['approved', 'pending', 'rejected']

const router = Router()
router.use(auth)

const byId = (id) => db.prepare('SELECT * FROM attendance WHERE id = ?').get(id)
const todayRow = (userId) => db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, toDateStr())

router.post('/check-in', (req, res) => {
  const { mode, descriptor, note } = req.body || {}
  if (!MODES.includes(mode)) throw httpError(400, 'รูปแบบการเข้างานไม่ถูกต้อง')
  if (todayRow(req.user.id)) throw httpError(400, 'วันนี้ลงเวลาเข้างานแล้ว')

  let faceVerified = 0
  let faceDistance = null
  if (mode === 'building') {
    if (!isDescriptor(descriptor)) throw httpError(400, 'กรุณาสแกนใบหน้า')
    const face = verifyFace(req.user, descriptor)
    if (!face.enrolled) throw httpError(400, 'ยังไม่ได้ลงทะเบียนใบหน้า กรุณาลงทะเบียนที่หน้าข้อมูลส่วนตัว')
    if (!face.match) throw httpError(400, 'ใบหน้าไม่ตรงกับที่ลงทะเบียนไว้ กรุณาลองใหม่')
    faceVerified = 1
    faceDistance = face.distance
  }

  const now = new Date()
  const checkInAt = toDateTimeStr(now)
  const info = db.prepare(`INSERT INTO attendance (user_id, date, mode, check_in_at, status, late_minutes, face_verified, face_distance, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    req.user.id, toDateStr(now), mode, checkInAt, mode === 'wfh' ? 'pending' : 'approved',
    lateMinutes(checkInAt, getSettings()), faceVerified, faceDistance, String(note || '').trim() || null,
  )
  res.status(201).json(byId(info.lastInsertRowid))
})

router.post('/check-out', (req, res) => {
  const row = todayRow(req.user.id)
  if (!row) throw httpError(400, 'วันนี้ยังไม่ได้ลงเวลาเข้างาน')
  if (row.status === 'rejected') throw httpError(400, 'รายการเข้างานวันนี้ไม่ได้รับอนุมัติ')
  if (row.check_out_at) throw httpError(400, 'วันนี้ลงเวลาออกงานแล้ว')
  db.prepare('UPDATE attendance SET check_out_at = ? WHERE id = ?').run(toDateTimeStr(), row.id)
  res.json(byId(row.id))
})

router.get('/today', (req, res) => res.json(todayRow(req.user.id) || null))

router.get('/me', (req, res) => {
  const { from, to } = req.query
  const where = ['user_id = ?']
  const args = [req.user.id]
  if (from) { where.push('date >= ?'); args.push(String(from)) }
  if (to) { where.push('date <= ?'); args.push(String(to)) }
  res.json(db.prepare(`SELECT * FROM attendance WHERE ${where.join(' AND ')} ORDER BY date DESC`).all(...args))
})

// count/minutes = all-time, month_* = the requested month; rejected records are not counted
router.get('/me/late-summary', (req, res) => {
  const month = String(req.query.month || toDateStr().slice(0, 7))
  res.json(db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(late_minutes),0) minutes,
      COUNT(CASE WHEN substr(date,1,7) = ? THEN 1 END) month_count,
      COALESCE(SUM(CASE WHEN substr(date,1,7) = ? THEN late_minutes END),0) month_minutes
    FROM attendance WHERE user_id = ? AND late_minutes > 0 AND status != 'rejected'`).get(month, month, req.user.id))
})

router.get('/', requireRole('admin'), (req, res) => {
  const { date, status, mode } = req.query
  const where = []
  const args = []
  if (date) { where.push('a.date = ?'); args.push(String(date)) }
  if (STATUSES.includes(status)) { where.push('a.status = ?'); args.push(status) }
  if (MODES.includes(mode)) { where.push('a.mode = ?'); args.push(mode) }
  res.json(db.prepare(`SELECT a.*, u.name, u.emp_code, u.department FROM attendance a JOIN users u ON u.id = a.user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.date DESC, a.check_in_at DESC LIMIT 500`).all(...args))
})

function review(req, status, reason) {
  const row = byId(req.params.id)
  if (!row) throw httpError(404, 'ไม่พบรายการ')
  if (row.mode !== 'wfh' || row.status !== 'pending') throw httpError(400, 'รายการนี้ไม่ได้รออนุมัติ')
  db.prepare('UPDATE attendance SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?')
    .run(status, reason, req.user.id, toDateTimeStr(), row.id)
  return byId(row.id)
}

router.post('/:id/approve', requireRole('admin'), (req, res) => res.json(review(req, 'approved', null)))

router.post('/:id/reject', requireRole('admin'), (req, res) => {
  const reason = String(req.body?.reason || '').trim()
  if (!reason) throw httpError(400, 'กรุณาระบุเหตุผล')
  res.json(review(req, 'rejected', reason))
})

export default router
