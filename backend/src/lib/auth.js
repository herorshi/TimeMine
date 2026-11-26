import jwt from 'jsonwebtoken'
import { db } from '../db/index.js'
import { httpError } from './http.js'
import { effectivePermissions } from './permissions.js'

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me'
export const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: '7d' })

/** safe user shape for API responses */
export function publicUser(u) {
  if (!u) return null
  const { password_hash, face_descriptor, ...rest } = u
  return { ...rest, active: !!u.active, face_enrolled: !!face_descriptor, permissions: effectivePermissions(u) }
}

/** requires a valid Bearer token; sets req.user (full row) */
export function auth(req, _res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '')
  try {
    const { sub } = jwt.verify(token, SECRET)
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(sub)
    if (!user) throw new Error()
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
