import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { otAmount } from '../lib/payroll.js'
import { getSettings } from '../lib/settings.js'
import { toDateStr, toDateTimeStr, hhmmToMin } from '../lib/time.js'

const router = Router()
router.use(auth)

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s)
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

function findRequest(id) {
  const row = db.prepare('SELECT * FROM ot_requests WHERE id = ?').get(id)
  if (!row) throw httpError(404, 'ไม่พบคำขอ OT')
  return row
}
function findPending(id) {
  const row = findRequest(id)
  if (row.status !== 'pending') throw httpError(400, 'คำขอนี้ถูกดำเนินการไปแล้ว')
  return row
}

router.get('/me', (req, res) => {
  res.json(db.prepare('SELECT * FROM ot_requests WHERE user_id = ? ORDER BY date DESC, start_time DESC').all(req.user.id))
})

// approved hours/money of the month and of its year; pending = all requests still waiting
router.get('/me/summary', (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : toDateStr().slice(0, 7)
  const approved = db.prepare(`SELECT COALESCE(SUM(hours),0) hours, COALESCE(SUM(amount),0) amount FROM ot_requests
    WHERE user_id = ? AND status = 'approved' AND date LIKE ?`)
  const m = approved.get(req.user.id, `${month}-%`)
  const y = approved.get(req.user.id, `${month.slice(0, 4)}-%`)
  const pending = db.prepare("SELECT COUNT(*) n FROM ot_requests WHERE user_id = ? AND status = 'pending'").get(req.user.id).n
  res.json({ hours: m.hours, amount: m.amount, pending, year_hours: y.hours, year_amount: y.amount })
})

router.post('/', (req, res) => {
  const { date, start_time, end_time } = req.body || {}
  const reason = String(req.body?.reason || '').trim()
  if (!isDate(date)) throw httpError(400, 'กรุณาระบุวันที่ให้ถูกต้อง')
  if (!isTime(start_time) || !isTime(end_time)) throw httpError(400, 'กรุณาระบุเวลาให้ถูกต้อง')
  const minutes = hhmmToMin(end_time) - hhmmToMin(start_time)
  if (minutes <= 0) throw httpError(400, 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม')
  if (!reason) throw httpError(400, 'กรุณาระบุเหตุผล')
  const overlap = db.prepare(`SELECT 1 FROM ot_requests WHERE user_id = ? AND date = ? AND status != 'rejected'
    AND start_time < ? AND end_time > ?`).get(req.user.id, date, end_time, start_time)
  if (overlap) throw httpError(400, 'ช่วงเวลานี้ซ้อนกับคำขอ OT ที่มีอยู่แล้ว')
  const hours = Math.round((minutes / 60) * 100) / 100
  const { lastInsertRowid } = db.prepare(`INSERT INTO ot_requests (user_id, date, start_time, end_time, hours, reason)
    VALUES (?, ?, ?, ?, ?, ?)`).run(req.user.id, date, start_time, end_time, hours, reason)
  res.status(201).json(findRequest(lastInsertRowid))
})

// the schema has no 'cancelled' status for OT, so cancelling a pending request removes it
router.post('/:id/cancel', (req, res) => {
  const row = db.prepare('SELECT user_id FROM ot_requests WHERE id = ?').get(req.params.id)
  if (!row || row.user_id !== req.user.id) throw httpError(404, 'ไม่พบคำขอ OT')
  findPending(req.params.id)
  db.prepare('DELETE FROM ot_requests WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.get('/', requireRole('admin'), (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null
  const rows = db.prepare(`SELECT o.*, u.name user_name, u.emp_code, u.department, u.salary
    FROM ot_requests o JOIN users u ON u.id = o.user_id
    ${status ? 'WHERE o.status = ?' : ''} ORDER BY o.date DESC, o.id DESC`).all(...(status ? [status] : []))
  const s = getSettings()
  res.json(rows.map(({ salary, ...r }) => ({ ...r, estimated_amount: r.status === 'pending' ? otAmount({ salary }, r.hours, s) : r.amount })))
})

router.post('/:id/approve', requireRole('admin'), (req, res) => {
  const row = findPending(req.params.id)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id)
  db.prepare(`UPDATE ot_requests SET status = 'approved', amount = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`)
    .run(otAmount(user, row.hours), req.user.id, toDateTimeStr(), row.id)
  res.json(findRequest(row.id))
})

router.post('/:id/reject', requireRole('admin'), (req, res) => {
  const reason = String(req.body?.reason || '').trim()
  if (!reason) throw httpError(400, 'กรุณาระบุเหตุผล')
  const row = findPending(req.params.id)
  db.prepare(`UPDATE ot_requests SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`)
    .run(reason, req.user.id, toDateTimeStr(), row.id)
  res.json(findRequest(row.id))
})

export default router
