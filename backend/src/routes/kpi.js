// Annual KPI evaluation — contract in docs/kpi.md
import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { toDateStr, toDateTimeStr } from '../lib/time.js'
import { attendanceScore, totalScore, grade, MANUAL_KEYS } from '../lib/kpi.js'

const router = Router()
router.use(auth)

const currentYear = () => Number(toDateStr().slice(0, 4))
const yearOf = (req) => {
  if (req.query.year === undefined || req.query.year === '') return currentYear()
  const y = Number(req.query.year)
  if (!Number.isInteger(y) || y < 2000 || y > currentYear()) throw httpError(400, 'ปีที่ประเมินไม่ถูกต้อง')
  return y
}
const userShape = (u) => ({ id: u.id, name: u.name, emp_code: u.emp_code, department: u.department, position: u.position, role: u.role })
const getEvaluation = async (userId, year) =>
  (await db.prepare('SELECT * FROM kpi_evaluations WHERE user_id = ? AND year = ?').get(userId, year)) || null
const listYears = async () => (await db.prepare(`SELECT year FROM kpi_evaluations
  UNION SELECT CAST(substr(date,1,4) AS INTEGER) FROM attendance ORDER BY year DESC`).all()).map((r) => r.year)

router.get('/me', async (req, res) => {
  const year = yearOf(req)
  const row = await getEvaluation(req.user.id, year)
  res.json({ year, evaluation: row?.status === 'final' ? row : null, attendance: await attendanceScore(req.user, year) })
})

router.get('/candidates', requireRole('admin'), async (req, res) => {
  const year = yearOf(req)
  const users = await db.prepare("SELECT * FROM users WHERE active = 1 AND role != 'executive' ORDER BY emp_code").all()
  res.json(await Promise.all(users.map(async (u) => ({
    user: userShape(u), attendance: await attendanceScore(u, year), evaluation: await getEvaluation(u.id, year),
  }))))
})

router.put('/evaluations/:userId', requireRole('admin'), async (req, res) => {
  const year = yearOf(req)
  const user = await db.prepare("SELECT * FROM users WHERE id = ? AND active = 1 AND role != 'executive'").get(Number(req.params.userId) || 0)
  if (!user) throw httpError(404, 'ไม่พบพนักงาน')
  if (req.user.role === 'admin' && user.id === req.user.id) throw httpError(403, 'ไม่สามารถประเมินตัวเองได้')
  const status = req.body?.status
  if (status !== 'draft' && status !== 'final') throw httpError(400, 'สถานะการประเมินไม่ถูกต้อง')
  const values = {}
  for (const k of MANUAL_KEYS) {
    const v = req.body[k] ?? null
    if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 5)) throw httpError(400, 'คะแนนแต่ละหัวข้อต้องเป็นจำนวนเต็ม 1–5')
    if (v === null && status === 'final') throw httpError(400, 'กรุณาให้คะแนนให้ครบทุกหัวข้อก่อนยืนยันผล')
    values[k] = v
  }
  const comment = String(req.body.comment || '').trim() || null

  // one write tx: the "final is locked" check and the upsert must not be split by another request
  const row = await db.transaction(async () => {
    const existing = await getEvaluation(user.id, year)
    if (existing?.status === 'final' && req.user.role !== 'executive')
      throw httpError(403, 'ผลประเมินนี้ยืนยันแล้ว เฉพาะผู้บริหารเท่านั้นที่แก้ไขได้')
    const attendance_score = (await attendanceScore(user, year)).score
    const total = totalScore({ attendance_score, ...values })
    const now = toDateTimeStr()
    await db.prepare(`INSERT INTO kpi_evaluations (user_id, year, attendance_score, quality, productivity, teamwork, responsibility,
        total_score, grade, comment, status, evaluator_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT (user_id, year) DO UPDATE SET attendance_score = excluded.attendance_score, quality = excluded.quality,
        productivity = excluded.productivity, teamwork = excluded.teamwork, responsibility = excluded.responsibility,
        total_score = excluded.total_score, grade = excluded.grade, comment = excluded.comment, status = excluded.status,
        evaluator_id = excluded.evaluator_id, updated_at = excluded.updated_at`)
      .run(user.id, year, attendance_score, ...MANUAL_KEYS.map((k) => values[k]), total, grade(total), comment, status, req.user.id, now, now)
    return getEvaluation(user.id, year)
  })()
  res.json(row)
})

router.get('/ranking', requireRole('executive'), async (req, res) => {
  const year = yearOf(req)
  const found = await db.prepare(`SELECT k.total_score, k.grade, k.attendance_score, k.quality, k.productivity, k.teamwork,
      k.responsibility, k.status, u.id, u.name, u.emp_code, u.department, u.position, u.role
    FROM kpi_evaluations k JOIN users u ON u.id = k.user_id WHERE k.year = ?`).all(year)
  found.sort((a, b) => b.total_score - a.total_score || b.attendance_score - a.attendance_score || a.name.localeCompare(b.name, 'th'))
  const rows = found.map((r, i) => ({
    rank: i + 1, user: userShape(r), total_score: r.total_score, grade: r.grade, attendance_score: r.attendance_score,
    quality: r.quality, productivity: r.productivity, teamwork: r.teamwork, responsibility: r.responsibility, status: r.status,
  }))
  const avg = (list) => (list.length ? Math.round((list.reduce((s, r) => s + r.total_score, 0) / list.length) * 10) / 10 : 0)
  const departments = new Map()
  for (const r of rows) departments.set(r.user.department, [...(departments.get(r.user.department) || []), r])
  const by_department = [...departments].map(([department, list]) => ({ department, avg: avg(list), count: list.length }))
    .sort((a, b) => b.avg - a.avg)
  const grade_counts = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  for (const r of rows) grade_counts[r.grade]++
  res.json({ year, years: await listYears(), rows, by_department, grade_counts, average: avg(rows) })
})

router.get('/years', async (_req, res) => res.json(await listYears()))

export default router
