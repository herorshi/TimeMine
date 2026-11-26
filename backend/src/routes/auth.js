import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { auth, signToken, publicUser } from '../lib/auth.js'
import { httpError } from '../lib/http.js'

const router = Router()

router.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = ? AND active = 1').get(email)
  if (!user || !bcrypt.compareSync(String(req.body?.password || ''), user.password_hash))
    throw httpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  res.json({ token: signToken(user), user: publicUser(user) })
})

router.get('/me', auth, (req, res) => res.json(publicUser(req.user)))

router.post('/change-password', auth, (req, res) => {
  const { current, next } = req.body || {}
  if (!bcrypt.compareSync(String(current || ''), req.user.password_hash)) throw httpError(400, 'รหัสผ่านเดิมไม่ถูกต้อง')
  if (String(next || '').length < 6) throw httpError(400, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id)
  res.json({ ok: true })
})

export default router
