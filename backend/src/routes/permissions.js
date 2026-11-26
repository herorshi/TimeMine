import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { PERMISSIONS, isPermKey, keysForRole, roleDefaults, overridesFor, effectivePermissions } from '../lib/permissions.js'

// Executive only: role defaults + per-user overrides.
const router = Router()
router.use(auth, requireRole('executive'))

const roleMatrix = async () => ({ admin: await roleDefaults('admin'), employee: await roleDefaults('employee') })

router.get('/catalog', async (_req, res) => res.json(PERMISSIONS))
router.get('/roles', async (_req, res) => res.json(await roleMatrix()))
router.put('/roles', async (req, res) => {
  const { role, perms } = req.body || {}
  if (!['admin', 'employee'].includes(role)) throw httpError(400, 'บทบาทไม่ถูกต้อง')
  if (!perms || typeof perms !== 'object') throw httpError(400, 'ข้อมูลสิทธิ์ไม่ถูกต้อง')
  const allowedKeys = role === 'employee' ? PERMISSIONS.filter((p) => p.group === 'employee').map((p) => p.key) : keysForRole('admin')
  const up = db.prepare('INSERT INTO role_permissions (role, perm, allowed) VALUES (?, ?, ?) ON CONFLICT(role, perm) DO UPDATE SET allowed = excluded.allowed')
  await db.transaction(async () => {
    for (const [k, v] of Object.entries(perms)) {
      if (!allowedKeys.includes(k)) continue
      // employee-group keys are stored on the employee row (they apply to every role)
      const target = PERMISSIONS.find((p) => p.key === k).group === 'employee' ? 'employee' : 'admin'
      await up.run(target, k, v ? 1 : 0)
    }
  })()
  res.json(await roleMatrix())
})

async function userView(id) {
  const u = await db.prepare('SELECT id, name, emp_code, role, department FROM users WHERE id = ?').get(id)
  if (!u) throw httpError(404, 'ไม่พบผู้ใช้')
  const eff = new Set(await effectivePermissions(u))
  return {
    user: u,
    role_defaults: await roleDefaults(u.role),
    overrides: await overridesFor(u.id),
    effective: Object.fromEntries(keysForRole(u.role).map((k) => [k, eff.has(k)])),
  }
}
router.get('/users/:id', async (req, res) => res.json(await userView(req.params.id)))
router.put('/users/:id', async (req, res) => {
  const view = await userView(req.params.id)
  if (view.user.role === 'executive') throw httpError(400, 'ผู้บริหารมีสิทธิ์ทุกอย่างเสมอ')
  const overrides = req.body?.overrides
  if (!overrides || typeof overrides !== 'object') throw httpError(400, 'ข้อมูลสิทธิ์ไม่ถูกต้อง')
  const keys = keysForRole(view.user.role)
  const del = db.prepare('DELETE FROM user_permissions WHERE user_id = ? AND perm = ?')
  const up = db.prepare('INSERT INTO user_permissions (user_id, perm, allowed) VALUES (?, ?, ?) ON CONFLICT(user_id, perm) DO UPDATE SET allowed = excluded.allowed')
  await db.transaction(async () => {
    for (const [k, v] of Object.entries(overrides)) {
      if (!isPermKey(k) || !keys.includes(k)) continue
      if (v === null || v === undefined) await del.run(view.user.id, k)
      else await up.run(view.user.id, k, v ? 1 : 0)
    }
  })()
  res.json(await userView(view.user.id))
})

export default router
