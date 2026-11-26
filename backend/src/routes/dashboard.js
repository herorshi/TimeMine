import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, isAdmin } from '../lib/auth.js'
import { leaveTypesFor } from '../lib/constants.js'
import { toDateStr } from '../lib/time.js'

const router = Router()
router.use(auth)

const round2 = (n) => Math.round(n * 100) / 100

router.get('/me', (req, res) => {
  const user = req.user
  const today = toDateStr()
  const month = today.slice(0, 7)
  const year = today.slice(0, 4)

  const todayRow = db.prepare(`SELECT id, date, mode, check_in_at, check_out_at, status, late_minutes, reject_reason
    FROM attendance WHERE user_id=? AND date=?`).get(user.id, today) || null

  // rejected check-ins do not count as late
  const late = db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(late_minutes),0) minutes,
      COALESCE(SUM(substr(date,1,7)=@month),0) month_count,
      COALESCE(SUM(CASE WHEN substr(date,1,7)=@month THEN late_minutes ELSE 0 END),0) month_minutes
    FROM attendance WHERE user_id=@id AND late_minutes>0 AND status!='rejected'`).get({ id: user.id, month })

  const used = Object.fromEntries(db.prepare(`SELECT type, SUM(days) days FROM leaves
    WHERE user_id=? AND status='approved' AND substr(start_date,1,4)=? GROUP BY type`).all(user.id, year)
    .map((r) => [r.type, r.days]))
  const balances = leaveTypesFor(user.gender).map((t) => ({ type: t.key, label: t.label, quota: t.quota, used: used[t.key] || 0 }))

  const ot = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status='approved' THEN hours ELSE 0 END),0) hours,
      COALESCE(SUM(CASE WHEN status='approved' THEN amount ELSE 0 END),0) amount,
      COALESCE(SUM(status='pending'),0) pending
    FROM ot_requests WHERE user_id=? AND substr(date,1,7)=?`).get(user.id, month)

  const announcements = db.prepare(`SELECT id, title, body, type, event_date, pinned, created_at
    FROM announcements ORDER BY created_at DESC, id DESC LIMIT 3`).all()
  const nextEvent = db.prepare(`SELECT id, title, body, type, event_date FROM announcements
    WHERE type='event' AND event_date>=? ORDER BY event_date, id LIMIT 1`).get(today) || null

  const activeWarnings = db.prepare(`SELECT COUNT(*) v FROM warnings WHERE user_id=? AND status='active'`).get(user.id).v

  const data = {
    today: todayRow,
    late,
    leave_balances: balances,
    ot: { hours: round2(ot.hours), amount: round2(ot.amount), pending: ot.pending },
    announcements,
    next_event: nextEvent,
    active_warnings: activeWarnings,
  }

  if (isAdmin(user)) {
    data.pending = db.prepare(`SELECT
      (SELECT COUNT(*) FROM attendance WHERE mode='wfh' AND status='pending') wfh,
      (SELECT COUNT(*) FROM leaves WHERE status='pending') leaves,
      (SELECT COUNT(*) FROM ot_requests WHERE status='pending') ot`).get()
  }

  res.json(data)
})

export default router
