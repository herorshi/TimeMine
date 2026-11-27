import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { httpError } from '../lib/http.js'
import { toDateTimeStr } from '../lib/time.js'
import { APP_URL, sendMail, usingEthereal } from '../lib/mailer.js'

// Public routes (no auth): forgot / reset password.
db.exec(`
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
`)

const TTL_MIN = 30
const COOLDOWN_SEC = 60
const INVALID = 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว'

const router = Router()
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** the unused, unexpired reset row of an active user, or 400 */
async function findReset(token) {
  const row = typeof token === 'string' && token && await db.prepare(`
    SELECT r.id, r.user_id, u.email FROM password_resets r JOIN users u ON u.id = r.user_id AND u.active = 1
    WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > ?`).get(sha256(token), toDateTimeStr())
  if (!row) throw httpError(400, INVALID)
  return row
}

const maskEmail = (email) => {
  const [name, domain = ''] = email.split('@')
  return `${name.slice(0, 2)}***@${domain}`
}

function resetMail(user, link, expiresAt) {
  const [date, time] = expiresAt.split(' ')
  const [y, m, d] = date.split('-')
  const expires = `${d}/${m}/${Number(y) + 543} เวลา ${time.slice(0, 5)} น.`
  return {
    to: user.email,
    subject: 'ตั้งรหัสผ่านใหม่ — TimeMint',
    text: `สวัสดีคุณ ${user.name}\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่: ${link}\nลิงก์ใช้ได้ครั้งเดียว หมดอายุ ${expires}\nหากคุณไม่ได้เป็นผู้ขอ ไม่ต้องดำเนินการใด ๆ`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
  <h2>ตั้งรหัสผ่านใหม่</h2>
  <p>สวัสดีคุณ ${escapeHtml(user.name)}</p>
  <p>เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี TimeMint ของคุณ</p>
  <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#0f766e;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;display:inline-block">ตั้งรหัสผ่านใหม่</a></p>
  <p>ลิงก์ใช้ได้ครั้งเดียว และหมดอายุ <strong>${expires}</strong> (${TTL_MIN} นาที)</p>
  <p style="color:#64748b;font-size:13px">หากคุณไม่ได้เป็นผู้ขอ ไม่ต้องดำเนินการใด ๆ รหัสผ่านเดิมยังใช้งานได้</p>
</div>`,
  }
}

router.post('/forgot', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const user = await db.prepare('SELECT id, email, name FROM users WHERE lower(email) = ? AND active = 1').get(email)
  const now = Date.now()
  // unknown email and rate-limited requests get the same answer as success (no user enumeration)
  if (!user) return res.json({ ok: true })

  const token = crypto.randomBytes(32).toString('hex')
  const createdAt = toDateTimeStr(new Date(now))
  const expiresAt = toDateTimeStr(new Date(now + TTL_MIN * 60000))
  // cooldown check and insert share one write tx, so concurrent requests can't both send
  const created = await db.transaction(async () => {
    if (await db.prepare('SELECT 1 FROM password_resets WHERE user_id = ? AND created_at > ?')
      .get(user.id, toDateTimeStr(new Date(now - COOLDOWN_SEC * 1000)))) return false
    await db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(createdAt, user.id)
    await db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(user.id, sha256(token), expiresAt, createdAt)
    return true
  })()
  if (!created) return res.json({ ok: true })

  const sending = sendMail(resetMail(user, `${APP_URL}/reset-password?token=${token}`, expiresAt))
    .catch((err) => { console.error(`[mail] send failed: ${err.code || err.message}`); return {} })
  // real SMTP: don't wait, so response time doesn't reveal whether the account exists
  if (!usingEthereal()) return res.json({ ok: true })
  const { previewUrl } = await sending
  res.json({ ok: true, ...(previewUrl && { preview_url: previewUrl }) })
})

router.get('/verify', async (req, res) => {
  const { token } = req.query
  req.originalUrl = `${req.baseUrl}/verify` // keeps the token out of the request log (morgan)
  res.json({ valid: true, email_masked: maskEmail((await findReset(token)).email) })
})

router.post('/reset', async (req, res) => {
  const { token, password } = req.body || {}
  const row = await findReset(token)
  if (typeof password !== 'string' || password.length < 6) throw httpError(400, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
  const hash = bcrypt.hashSync(password, 10)
  await db.transaction(async () => {
    // claim the token inside the tx: a concurrent reset may have used it since findReset
    const { changes } = await db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL').run(toDateTimeStr(), row.id)
    if (!changes) throw httpError(400, INVALID)
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id)
  })()
  res.json({ ok: true })
})

export default router
