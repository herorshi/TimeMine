import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { LEAVE_TYPES, leaveTypesFor } from '../lib/constants.js'
import { toDateStr, toDateTimeStr, workingDaysBetween } from '../lib/time.js'

const router = Router()
router.use(auth)

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled']
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s
const label = (row) => ({ ...row, type_label: LEAVE_TYPES[row.type]?.label || row.type })

/** days of one type in a year (by start_date) for the given statuses */
const sumDays = (userId, type, year, statuses) => db.prepare(`SELECT COALESCE(SUM(days),0) v FROM leaves
  WHERE user_id=? AND type=? AND substr(start_date,1,4)=? AND status IN (${statuses.map(() => '?').join(',')})`)
  .get(userId, type, String(year), ...statuses).v

const findLeave = (id) => {
  const row = db.prepare('SELECT * FROM leaves WHERE id=?').get(id)
  if (!row) throw httpError(404, 'ไม่พบคำขอลา')
  return row
}
const getLeave = (id) => label(findLeave(id))

router.get('/types', (req, res) => res.json(leaveTypesFor(req.user.gender)))

router.get('/me', (req, res) => {
  res.json(db.prepare('SELECT * FROM leaves WHERE user_id=? ORDER BY created_at DESC, id DESC').all(req.user.id).map(label))
})

router.get('/me/balance', (req, res) => {
  const year = Number(req.query.year) || Number(toDateStr().slice(0, 4))
  res.json(leaveTypesFor(req.user.gender).map((t) => ({
    type: t.key, label: t.label, quota: t.quota, used: sumDays(req.user.id, t.key, year, ['approved']),
  })))
})

router.post('/', (req, res) => {
  const { type, start_date, end_date } = req.body || {}
  const reason = String(req.body?.reason || '').trim()
  const t = leaveTypesFor(req.user.gender).find((x) => x.key === type)
  if (!t) throw httpError(400, 'ประเภทการลาไม่ถูกต้อง')
  if (!isDate(start_date) || !isDate(end_date)) throw httpError(400, 'กรุณาระบุวันที่ให้ถูกต้อง')
  if (end_date < start_date) throw httpError(400, 'วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น')
  const year = start_date.slice(0, 4)
  if (end_date.slice(0, 4) !== year) throw httpError(400, 'กรุณาแยกคำขอลาข้ามปีเป็นปีละหนึ่งคำขอ')
  if (!reason) throw httpError(400, 'กรุณาระบุเหตุผลการลา')
  const days = workingDaysBetween(start_date, end_date)
  if (days <= 0) throw httpError(400, 'ช่วงวันที่เลือกไม่มีวันทำงาน')
  const overlap = db.prepare(`SELECT 1 FROM leaves WHERE user_id=? AND status IN ('pending','approved')
    AND start_date<=? AND end_date>=?`).get(req.user.id, end_date, start_date)
  if (overlap) throw httpError(400, 'มีคำขอลาในช่วงวันที่นี้อยู่แล้ว')
  if (t.quota !== null) {
    const left = t.quota - sumDays(req.user.id, type, year, ['pending', 'approved'])
    if (days > left) throw httpError(400, `โควตา${t.label}ไม่พอ (เหลือ ${Math.max(0, left)} วัน รวมคำขอที่รออนุมัติ)`)
  }
  const { lastInsertRowid } = db.prepare(`INSERT INTO leaves (user_id,type,start_date,end_date,days,reason,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(req.user.id, type, start_date, end_date, days, reason, toDateTimeStr())
  res.status(201).json(getLeave(lastInsertRowid))
})

router.post('/:id/cancel', (req, res) => {
  const row = findLeave(req.params.id)
  if (row.user_id !== req.user.id) throw httpError(404, 'ไม่พบคำขอลา')
  if (row.status !== 'pending') throw httpError(400, 'ยกเลิกได้เฉพาะคำขอที่รออนุมัติ')
  db.prepare("UPDATE leaves SET status='cancelled' WHERE id=?").run(row.id)
  res.json(getLeave(row.id))
})

router.get('/', requireRole('admin'), (req, res) => {
  const { status } = req.query
  if (status && !STATUSES.includes(status)) throw httpError(400, 'สถานะไม่ถูกต้อง')
  res.json(db.prepare(`SELECT l.*, u.name AS user_name, u.emp_code, u.department FROM leaves l
    JOIN users u ON u.id = l.user_id ${status ? 'WHERE l.status = ?' : ''}
    ORDER BY (l.status='pending') DESC, l.created_at DESC, l.id DESC`).all(...(status ? [status] : [])).map(label))
})

function review(req, status, rejectReason = null) {
  const row = findLeave(req.params.id)
  if (row.status !== 'pending') throw httpError(400, 'คำขอนี้ถูกดำเนินการแล้ว')
  db.prepare('UPDATE leaves SET status=?, reject_reason=?, reviewed_by=?, reviewed_at=? WHERE id=?')
    .run(status, rejectReason, req.user.id, toDateTimeStr(), row.id)
  return getLeave(row.id)
}

router.post('/:id/approve', requireRole('admin'), (req, res) => res.json(review(req, 'approved')))

router.post('/:id/reject', requireRole('admin'), (req, res) => {
  const reason = String(req.body?.reason || '').trim()
  if (!reason) throw httpError(400, 'กรุณาระบุเหตุผลที่ไม่อนุมัติ')
  res.json(review(req, 'rejected', reason))
})

export default router
