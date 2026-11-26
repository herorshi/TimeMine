// Annual KPI scoring — contract in docs/kpi.md
import { db } from '../db/index.js'
import { toDateStr } from './time.js'

const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10
export const MANUAL_KEYS = ['quality', 'productivity', 'teamwork', 'responsibility']

/** { score, late_count, late_minutes, absent_days, warnings } for one user row in one year. Rejected check-ins do not count. */
export async function attendanceScore(user, year) {
  const first = `${year}-01-01`
  const last = `${year}-12-31`
  const att = await db.prepare("SELECT date, late_minutes FROM attendance WHERE user_id = ? AND date BETWEEN ? AND ? AND status != 'rejected'")
    .all(user.id, first, last)
  const leaves = await db.prepare("SELECT start_date, end_date FROM leaves WHERE user_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?")
    .all(user.id, last, first)
  const holidays = new Set((await db.prepare('SELECT date FROM holidays WHERE date BETWEEN ? AND ?').all(first, last)).map((h) => h.date))
  const warnings = (await db.prepare("SELECT COUNT(*) n FROM warnings WHERE user_id = ? AND status = 'active' AND substr(issued_at,1,4) = ?")
    .get(user.id, String(year))).n

  const lates = att.filter((a) => a.late_minutes > 0)
  const lateMins = lates.reduce((sum, a) => sum + a.late_minutes, 0)
  const present = new Set(att.map((a) => a.date))
  const from = user.start_date && user.start_date > first ? user.start_date : first
  const today = toDateStr()
  const to = today < last ? today : last
  let absent = 0
  for (const d = new Date(`${from}T00:00:00`); toDateStr(d) <= to; d.setDate(d.getDate() + 1)) {
    const ds = toDateStr(d)
    if (d.getDay() === 0 || d.getDay() === 6 || holidays.has(ds) || present.has(ds)) continue
    if (leaves.some((l) => l.start_date <= ds && l.end_date >= ds)) continue
    absent++
  }
  const raw = 100 - lates.length - Math.min(30, lateMins * 0.05) - absent * 5 - warnings * 10
  return { score: round1(Math.min(100, Math.max(0, raw))), late_count: lates.length, late_minutes: lateMins, absent_days: absent, warnings }
}

/** weighted 0-100 from { attendance_score, quality, ... }; any missing manual value → attendance part only */
export function totalScore(row) {
  const complete = MANUAL_KEYS.every((k) => row[k] != null)
  const manual = complete ? MANUAL_KEYS.reduce((sum, k) => sum + 0.2 * row[k] * 20, 0) : 0
  return round1(0.2 * row.attendance_score + manual)
}

export const grade = (total) => (total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F')
