import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { PERMISSIONS, isPermKey, keysForRole, roleDefaults, overridesFor, effectivePermissions } from '../lib/permissions.js'

// Executive only: role defaults + per-user overrides.
const router = Router()
router.use(auth, requireRole('executive'))

const roleMatrix = () => ({ admin: roleDefaults('admin'), employee: roleDefaults('employee') })

router.get('/catalog', (_req, res) => res.json(PERMISSIONS))
router.get('/roles', (_req, res) => res.json(roleMatrix()))
router.put('/roles', (req, res) => {
  const { role, perms } = req.body || {}
  if (!['admin', 'employee'].includes(role)) throw httpError(400, 'บทบาทไม่ถูกต้อง')
  if (!perms || typeof perms !== 'object') throw httpError(400, 'ข้อมูลสิทธิ์ไม่ถูกต้อง')
  const allowedKeys = role === 'employee' ? PERMISSIONS.filter((p) => p.group === 'employee').map((p) => p.key) : keysForRole('admin')
  const up = db.prepare('INSERT INTO role_permissions (role, perm, allowed) VALUES (?, ?, ?) ON CONFLICT(role, perm) DO UPDATE SET allowed = excluded.allowed')
  db.transaction(() => {
    for (const [k, v] of Object.entries(perms)) {
      if (!allowedKeys.includes(k)) continue
      // employee-group keys are stored on the employee row (they apply to every role)
      const target = PERMISSIONS.find((p) => p.key === k).group === 'employee' ? 'employee' : 'admin'
      up.run(target, k, v ? 1 : 0)
    }
  })()
  res.json(roleMatrix())
})

function userView(id) {
  const u = db.prepare('SELECT id, name, emp_code, role, department FROM users WHERE id = ?').get(id)
  if (!u) throw httpError(404, 'ไม่พบผู้ใช้')
  const eff = new Set(effectivePermissions(u))
  return {
    user: u,
    role_defaults: roleDefaults(u.role),
    overrides: overridesFor(u.id),
    effective: Object.fromEntries(keysForRole(u.role).map((k) => [k, eff.has(k)])),
  }
}
router.get('/users/:id', (req, res) => res.json(userView(req.params.id)))
router.put('/users/:id', (req, res) => {
  const view = userView(req.params.id)
  if (view.user.role === 'executive') throw httpError(400, 'ผู้บริหารมีสิทธิ์ทุกอย่างเสมอ')
  const overrides = req.body?.overrides
  if (!overrides || typeof overrides !== 'object') throw httpError(400, 'ข้อมูลสิทธิ์ไม่ถูกต้อง')
  const keys = keysForRole(view.user.role)
  const del = db.prepare('DELETE FROM user_permissions WHERE user_id = ? AND perm = ?')
  const up = db.prepare('INSERT INTO user_permissions (user_id, perm, allowed) VALUES (?, ?, ?) ON CONFLICT(user_id, perm) DO UPDATE SET allowed = excluded.allowed')
  db.transaction(() => {
    for (const [k, v] of Object.entries(overrides)) {
      if (!isPermKey(k) || !keys.includes(k)) continue
      if (v === null || v === undefined) del.run(view.user.id, k)
      else up.run(view.user.id, k, v ? 1 : 0)
    }
  })()
  res.json(userView(view.user.id))
})

export default router
