import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { auth, signToken, publicUser } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { loginLimiter, takeAttempt, clearAttempts, lockedError } from '../lib/security.js'

const router = Router()
// compared when the email is unknown, so response time does not reveal which accounts exist
const DUMMY_HASH = bcrypt.hashSync('no-such-user', 10)

router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const attempt = takeAttempt(email)
  const user = await db.prepare('SELECT * FROM users WHERE lower(email) = ? AND active = 1').get(email)
  const match = await bcrypt.compare(String(req.body?.password || ''), user?.password_hash || DUMMY_HASH)
  if (!user || !match) {
    if (attempt.lockedUntil) throw lockedError(attempt.lockedUntil)
    throw httpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  }
  clearAttempts(email)
  res.json({ token: signToken(user), user: await publicUser(user) })
})

router.get('/me', auth, async (req, res) => res.json(await publicUser(req.user)))

router.post('/change-password', auth, async (req, res) => {
  const { current, next } = req.body || {}
  if (!(await bcrypt.compare(String(current || ''), req.user.password_hash))) throw httpError(400, 'รหัสผ่านเดิมไม่ถูกต้อง')
  if (String(next || '').length < 6) throw httpError(400, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
  const password_hash = await bcrypt.hash(String(next), 10)
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, req.user.id)
  // every older token is now invalid (pwv); hand the caller a fresh one
  res.json({ ok: true, token: signToken({ ...req.user, password_hash }) })
})

export default router
