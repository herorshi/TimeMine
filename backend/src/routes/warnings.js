import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { toDateTimeStr } from '../lib/time.js'
import { WARNING_LEVELS, WARNING_CATEGORIES } from '../lib/constants.js'

const router = Router()
router.use(auth)

const SELECT = `SELECT w.*, u.name user_name, u.emp_code, u.department,
  i.name issued_by_name, c.name cancelled_by_name
  FROM warnings w JOIN users u ON u.id = w.user_id
  LEFT JOIN users i ON i.id = w.issued_by LEFT JOIN users c ON c.id = w.cancelled_by`
const ORDER = ' ORDER BY w.issued_at DESC, w.id DESC'
const getOne = (id) => db.prepare(`${SELECT} WHERE w.id = ?`).get(id)

router.get('/me', (req, res) => {
  res.json(db.prepare(`${SELECT} WHERE w.user_id = ?${ORDER}`).all(req.user.id))
})

router.get('/', requireRole('admin'), (req, res) => {
  const where = []
  const args = []
  if (req.query.user_id) { where.push('w.user_id = ?'); args.push(Number(req.query.user_id)) }
  if (req.query.status) { where.push('w.status = ?'); args.push(String(req.query.status)) }
  res.json(db.prepare(`${SELECT}${where.length ? ' WHERE ' + where.join(' AND ') : ''}${ORDER}`).all(...args))
})

router.post('/', requireRole('admin'), (req, res) => {
  const { user_id, level, category } = req.body || {}
  const reason = String(req.body?.reason || '').trim()
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(Number(user_id) || 0)
  if (!user) throw httpError(400, 'ไม่พบพนักงาน')
  if (!Object.hasOwn(WARNING_LEVELS, level)) throw httpError(400, 'ระดับใบเตือนไม่ถูกต้อง')
  if (!Object.hasOwn(WARNING_CATEGORIES, category)) throw httpError(400, 'หมวดหมู่ไม่ถูกต้อง')
  if (!reason) throw httpError(400, 'กรุณาระบุเหตุผล')
  const r = db.prepare('INSERT INTO warnings (user_id, level, category, reason, issued_by, issued_at) VALUES (?,?,?,?,?,?)')
    .run(user.id, level, category, reason, req.user.id, toDateTimeStr())
  res.status(201).json(getOne(r.lastInsertRowid))
})

router.post('/:id/cancel', requireRole('admin'), (req, res) => {
  const reason = String(req.body?.reason || '').trim()
  if (!reason) throw httpError(400, 'กรุณาระบุเหตุผลที่ยกเลิก')
  const w = getOne(Number(req.params.id) || 0)
  if (!w) throw httpError(404, 'ไม่พบใบเตือน')
  if (w.status !== 'active') throw httpError(400, 'ใบเตือนนี้ถูกยกเลิกแล้ว')
  db.prepare("UPDATE warnings SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?")
    .run(reason, req.user.id, toDateTimeStr(), w.id)
  res.json(getOne(w.id))
})

export default router
