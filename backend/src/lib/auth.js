import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { db } from '../db/index.js'
import { httpError } from './http.js'
import { effectivePermissions } from './permissions.js'
import { isProduction } from './security.js'

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me'
if (isProduction && (process.env.JWT_SECRET || '').length < 32)
  throw new Error('JWT_SECRET must be set to at least 32 characters in production')
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'

/** password version: changes whenever the password hash changes (hashed: the bcrypt prefix itself is constant) */
const pwv = (user) => crypto.createHash('sha256').update(user.password_hash).digest('hex').slice(0, 16)
export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, pwv: pwv(user) }, SECRET, { algorithm: 'HS256', expiresIn: EXPIRES_IN })

/** safe user shape for API responses */
export async function publicUser(u) {
  if (!u) return null
  const { password_hash, face_descriptor, ...rest } = u
  return { ...rest, active: !!u.active, face_enrolled: !!face_descriptor, permissions: await effectivePermissions(u) }
}

/** requires a valid Bearer token; sets req.user (full row) */
export async function auth(req, _res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '')
  try {
    const claims = jwt.verify(token, SECRET, { algorithms: ['HS256'] })
    const user = await db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(claims.sub)
    if (!user || !claims.exp || claims.pwv !== pwv(user)) throw new Error()
    req.user = user
    next()
  } catch {
    next(httpError(401, 'กรุณาเข้าสู่ระบบ'))
  }
}

/** executive can do everything admin can */
export const requireRole = (...roles) => (req, _res, next) => {
  const ok = roles.includes(req.user.role) || (req.user.role === 'executive')
  next(ok ? undefined : httpError(403, 'ไม่มีสิทธิ์เข้าถึง'))
}
export const isAdmin = (u) => u.role === 'admin' || u.role === 'executive'
