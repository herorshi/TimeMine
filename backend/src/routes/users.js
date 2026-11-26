import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { auth, requireRole, publicUser } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { ROLES } from '../lib/constants.js'

const router = Router()
router.use(auth)

const SELF_FIELDS = ['name', 'phone', 'address', 'birthdate', 'avatar_url']
const ADMIN_FIELDS = [...SELF_FIELDS, 'emp_code', 'email', 'gender', 'role', 'department', 'position', 'start_date', 'salary', 'active']
const REQUIRED = { emp_code: 'กรุณาระบุรหัสพนักงาน', email: 'กรุณาระบุอีเมล', name: 'กรุณาระบุชื่อ' }

const findUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id)

/** validate + normalize the fields present in body (whitelist only) */
function pick(body = {}, fields) {
  const out = {}
  for (const k of fields) {
    if (body[k] === undefined) continue
    out[k] = typeof body[k] === 'string' ? body[k].trim() || null : body[k]
  }
  for (const [k, message] of Object.entries(REQUIRED)) if (k in out && !out[k]) throw httpError(400, message)
  for (const k of ['name', 'phone', 'address', 'birthdate', 'avatar_url', 'emp_code', 'email', 'department', 'position', 'start_date'])
    if (k in out && out[k] !== null && typeof out[k] !== 'string') throw httpError(400, 'ข้อมูลไม่ถูกต้อง')
  for (const k of ['birthdate', 'start_date'])
    if (out[k] && !/^\d{4}-\d{2}-\d{2}$/.test(out[k])) throw httpError(400, 'รูปแบบวันที่ไม่ถูกต้อง')
  if (out.avatar_url && !/^https?:\/\//i.test(out.avatar_url)) throw httpError(400, 'ลิงก์รูปต้องขึ้นต้นด้วย http:// หรือ https://')
  if ('email' in out) {
    out.email = out.email.toLowerCase()
    if (!/^\S+@\S+$/.test(out.email)) throw httpError(400, 'รูปแบบอีเมลไม่ถูกต้อง')
  }
  if ('gender' in out && !['M', 'F'].includes(out.gender)) throw httpError(400, 'กรุณาเลือกเพศ')
  if ('role' in out && !ROLES.includes(out.role)) throw httpError(400, 'สิทธิ์การใช้งานไม่ถูกต้อง')
  if ('salary' in out) {
    out.salary = Number(out.salary || 0)
    if (!Number.isFinite(out.salary) || out.salary < 0) throw httpError(400, 'เงินเดือนไม่ถูกต้อง')
  }
  if ('active' in out) out.active = out.active ? 1 : 0
  return out
}

function checkUnique({ emp_code, email }, id = 0) {
  if (emp_code && db.prepare('SELECT 1 FROM users WHERE emp_code = ? AND id != ?').get(emp_code, id))
    throw httpError(400, 'รหัสพนักงานนี้ถูกใช้แล้ว')
  if (email && db.prepare('SELECT 1 FROM users WHERE lower(email) = ? AND id != ?').get(email, id))
    throw httpError(400, 'อีเมลนี้ถูกใช้แล้ว')
}

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 6) throw httpError(400, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
}

function update(id, data) {
  const keys = Object.keys(data) // keys come from the whitelist in pick()
  if (keys.length) db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => data[k]), id)
  return publicUser(findUser(id))
}

/** load :id for an admin action; only an executive may manage executive accounts */
function target(req) {
  const user = findUser(req.params.id)
  if (!user) throw httpError(404, 'ไม่พบพนักงาน')
  if (user.role === 'executive' && req.user.role !== 'executive') throw httpError(403, 'เฉพาะผู้บริหารเท่านั้นที่จัดการบัญชีผู้บริหารได้')
  return user
}
function checkGrant(req, role) {
  if (role === 'executive' && req.user.role !== 'executive') throw httpError(403, 'เฉพาะผู้บริหารเท่านั้นที่กำหนดสิทธิ์ผู้บริหารได้')
}

router.get('/me', (req, res) => res.json(publicUser(req.user)))
router.put('/me', (req, res) => res.json(update(req.user.id, pick(req.body, SELF_FIELDS))))

router.get('/', requireRole('admin'), (_req, res) =>
  res.json(db.prepare('SELECT * FROM users ORDER BY active DESC, emp_code').all().map(publicUser)))

router.post('/', requireRole('admin'), (req, res) => {
  const data = pick(req.body, ADMIN_FIELDS)
  delete data.active
  for (const [k, message] of Object.entries(REQUIRED)) if (!data[k]) throw httpError(400, message)
  if (!data.gender) throw httpError(400, 'กรุณาเลือกเพศ')
  checkGrant(req, data.role)
  checkPassword(req.body?.password)
  checkUnique(data)
  data.password_hash = bcrypt.hashSync(req.body.password, 10)
  const keys = Object.keys(data)
  const { lastInsertRowid } = db.prepare(`INSERT INTO users (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...keys.map((k) => data[k]))
  res.status(201).json(publicUser(findUser(lastInsertRowid)))
})

router.put('/:id', requireRole('admin'), (req, res) => {
  const user = target(req)
  const data = pick(req.body, ADMIN_FIELDS)
  checkGrant(req, data.role)
  if (user.id === req.user.id) {
    if (data.role && data.role !== user.role) throw httpError(400, 'ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้')
    if (data.active === 0) throw httpError(400, 'ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้')
  }
  checkUnique(data, user.id)
  res.json(update(user.id, data))
})

router.post('/:id/reset-password', requireRole('admin'), (req, res) => {
  const user = target(req)
  checkPassword(req.body?.password)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(req.body.password, 10), user.id)
  res.json({ ok: true })
})

router.delete('/:id', requireRole('admin'), (req, res) => {
  const user = target(req)
  if (user.id === req.user.id) throw httpError(400, 'ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้')
  res.json(update(user.id, { active: 0 }))
})

export default router
