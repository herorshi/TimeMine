// Permissions: role defaults (role_permissions) + per-user overrides (user_permissions).
// Employee-group keys apply to every role (admins and executives are employees too);
// admin-group keys apply to the admin role. The executive always has everything.
import jwt from 'jsonwebtoken'
import { db } from '../db/index.js'

export const PERMISSIONS = [
  { key: 'checkin.office', label: 'ลงเวลาเข้างานที่ Office', group: 'employee' },
  { key: 'checkin.building', label: 'ลงเวลาเข้างานที่ตึก (สแกนหน้า)', group: 'employee' },
  { key: 'checkin.wfh', label: 'ขอ Work from Home', group: 'employee' },
  { key: 'leave.request', label: 'ยื่นลางาน', group: 'employee' },
  { key: 'ot.request', label: 'ขอทำ OT', group: 'employee' },
  { key: 'approve.attendance', label: 'ดูการเข้างาน / อนุมัติ WFH', group: 'admin' },
  { key: 'approve.leaves', label: 'อนุมัติการลา', group: 'admin' },
  { key: 'approve.ot', label: 'อนุมัติ OT', group: 'admin' },
  { key: 'warnings.manage', label: 'ออก / ยกเลิกใบเตือน', group: 'admin' },
  { key: 'announcements.manage', label: 'จัดการประกาศ', group: 'admin' },
  { key: 'holidays.manage', label: 'จัดการวันหยุด', group: 'admin' },
  { key: 'employees.manage', label: 'จัดการพนักงาน', group: 'admin' },
  { key: 'reports.view', label: 'ดูรายงาน', group: 'admin' },
  { key: 'settings.manage', label: 'ตั้งค่าระบบ', group: 'admin' },
  { key: 'kpi.manage', label: 'ประเมิน KPI พนักงาน', group: 'admin' },
]
const KEYS = new Set(PERMISSIONS.map((p) => p.key))
const GROUP = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.group]))
export const isPermKey = (k) => KEYS.has(k)

// tables role_permissions / user_permissions are created in db/index.js

/** keys that apply to a role: employee group for everyone, admin group for admin */
export const keysForRole = (role) => PERMISSIONS.filter((p) => p.group === 'employee' || role !== 'employee').map((p) => p.key)

export async function roleDefaults(role) {
  const rows = await db.prepare('SELECT perm, allowed FROM role_permissions WHERE role = ?').all(role === 'executive' ? 'admin' : role)
  const stored = Object.fromEntries(rows.map((r) => [r.perm, !!r.allowed]))
  const out = {}
  for (const k of keysForRole(role)) {
    // employee-group defaults always come from the employee row, admin-group from the admin row
    if (GROUP[k] === 'employee') {
      const r = await db.prepare("SELECT allowed FROM role_permissions WHERE role = 'employee' AND perm = ?").get(k)
      out[k] = r ? !!r.allowed : true
    } else out[k] = k in stored ? stored[k] : true
  }
  return out
}
export const overridesFor = async (userId) =>
  Object.fromEntries((await db.prepare('SELECT perm, allowed FROM user_permissions WHERE user_id = ?').all(userId)).map((r) => [r.perm, !!r.allowed]))

export async function effectivePermissions(user) {
  if (user.role === 'executive') return PERMISSIONS.map((p) => p.key)
  const eff = { ...(await roleDefaults(user.role)), ...pick(await overridesFor(user.id), keysForRole(user.role)) }
  return Object.entries(eff).filter(([, v]) => v).map(([k]) => k)
}
const pick = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)))
export const can = async (user, key) => user.role === 'executive' || (await effectivePermissions(user)).includes(key)

// Which permission an API call needs. Admin-only routes still also need the admin role (requireRole in the router).
const RULES = [
  { m: 'POST', re: /^\/attendance\/check-in$/, perm: (req) => ({ office: 'checkin.office', building: 'checkin.building', wfh: 'checkin.wfh' })[req.body?.mode] },
  { m: 'POST', re: /^\/leaves$/, perm: 'leave.request' },
  { m: 'POST', re: /^\/ot$/, perm: 'ot.request' },
  { m: 'GET', re: /^\/attendance$/, perm: 'approve.attendance' },
  { m: 'POST', re: /^\/attendance\/\d+\/(approve|reject)$/, perm: 'approve.attendance' },
  { m: 'GET', re: /^\/leaves$/, perm: 'approve.leaves' },
  { m: 'POST', re: /^\/leaves\/\d+\/(approve|reject)$/, perm: 'approve.leaves' },
  { m: 'GET', re: /^\/ot$/, perm: 'approve.ot' },
  { m: 'POST', re: /^\/ot\/\d+\/(approve|reject)$/, perm: 'approve.ot' },
  { m: 'GET', re: /^\/warnings$/, perm: 'warnings.manage' },
  { m: 'POST', re: /^\/warnings(\/\d+\/cancel)?$/, perm: 'warnings.manage' },
  { m: /^(POST|PUT|DELETE)$/, re: /^\/announcements(\/\d+.*)?$/, perm: 'announcements.manage' },
  { m: /^(POST|PUT|DELETE)$/, re: /^\/holidays(\/.*)?$/, perm: 'holidays.manage' },
  { m: /.*/, re: /^\/users(?!\/me(\/|$))(\/.*)?$/, perm: 'employees.manage' },
  { m: /.*/, re: /^\/reports(\/.*)?$/, perm: 'reports.view' },
  { m: 'PUT', re: /^\/settings$/, perm: 'settings.manage' },
  { m: /.*/, re: /^\/kpi\/(evaluations|candidates)(\/.*)?$/, perm: 'kpi.manage' },
]
const SECRET = process.env.JWT_SECRET || 'dev-only-change-me'

/** Express middleware mounted on /api before the routers. Anonymous calls pass through (routers answer 401). */
export async function permissionGate(req, res, next) {
  const path = req.path.replace(/\/+$/, '') || '/'
  const rule = RULES.find((r) => (typeof r.m === 'string' ? r.m === req.method : r.m.test(req.method)) && r.re.test(path))
  if (!rule) return next()
  const token = (req.headers.authorization || '').replace(/^Bearer /, '')
  let user
  try { user = await db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(jwt.verify(token, SECRET).sub) } catch { return next() }
  if (!user) return next()
  const perm = typeof rule.perm === 'function' ? rule.perm(req) : rule.perm
  if (!perm || (await can(user, perm))) return next()
  res.status(403).json({ error: 'คุณไม่ได้รับสิทธิ์ใช้งานส่วนนี้ กรุณาติดต่อผู้บริหาร' })
}
