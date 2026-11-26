// Rate limits, account lockout and production hardening helpers.
// State is in memory: per process (per instance on Vercel), reset on restart.
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { httpError } from './http.js'

export const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL

const limiter = (windowMs, limit, message, extra = {}) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message }, ...extra })

const MIN = 60 * 1000
export const apiLimiter = limiter(MIN, 300, 'มีการเรียกใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่')
export const loginLimiter = limiter(15 * MIN, 10, 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ใน 15 นาที', {
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || '')}|${String(req.body?.email || '').trim().toLowerCase()}`,
})
export const passwordLimiter = limiter(15 * MIN, 5, 'ขอตั้งรหัสผ่านบ่อยเกินไป กรุณาลองใหม่ใน 15 นาที')

export const MAX_FAILS = 5
const LOCK_MS = 15 * MIN
const attempts = new Map() // email -> { count, lockedUntil }

export const lockedError = (until) =>
  httpError(429, `บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ใน ${Math.max(1, Math.ceil((until - Date.now()) / MIN))} นาที`)

/**
 * Call before checking the password. Throws while locked; otherwise counts this attempt up front,
 * so parallel requests cannot get more than MAX_FAILS guesses. clearAttempts() on success.
 */
export function takeAttempt(email) {
  let a = attempts.get(email)
  if (a?.lockedUntil && a.lockedUntil <= Date.now()) a = undefined
  if (a?.lockedUntil) throw lockedError(a.lockedUntil)
  if (!a) {
    if (attempts.size >= 10000) attempts.delete(attempts.keys().next().value) // bound memory
    a = { count: 0, lockedUntil: 0 }
    attempts.set(email, a)
  }
  if (++a.count >= MAX_FAILS) a.lockedUntil = Date.now() + LOCK_MS
  return a
}
export const clearAttempts = (email) => attempts.delete(email)
