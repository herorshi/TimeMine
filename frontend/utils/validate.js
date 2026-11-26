// Phone and email rules (owner 2026-11-26). Shared by every form; the backend repeats them in routes/users.js.

/** digits only, starts with 0, 9–10 digits (landline 9, mobile 10) */
export const PHONE_RE = /^0\d{8,9}$/
export const PHONE_PATTERN = '0[0-9]{8,9}'
export const PHONE_HINT = 'ตัวเลขเท่านั้น ขึ้นต้นด้วย 0 (9–10 หลัก)'
/** keep digits only (use on @input), max 10 */
export const cleanPhone = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 10)
export const isPhone = (v) => !v || PHONE_RE.test(v)

/** English letters, digits and special characters only: name@domain.tld */
export const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/
export const EMAIL_PATTERN = '[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}'
export const EMAIL_HINT = 'ภาษาอังกฤษ ตัวเลข และอักขระพิเศษเท่านั้น เช่น name@company.com'
/** drop anything that is not printable ASCII (Thai letters, spaces) — use on @input */
export const cleanEmail = (v) => String(v ?? '').replace(/[^\x21-\x7E]/g, '')
export const isEmail = (v) => EMAIL_RE.test(String(v ?? ''))
