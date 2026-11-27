import { db } from '../db/index.js'
import { getSettings } from './settings.js'

/** all async: settings live in the DB */
export async function rates(user, s) {
  s = s || (await getSettings())
  const daily = user.salary / Number(s.work_days_per_month)
  const hourly = daily / Number(s.work_hours_per_day)
  return { daily, hourly, otHourly: hourly * Number(s.ot_multiplier) }
}
export const otAmount = async (user, hours, s) => Math.round((await rates(user, s)).otHourly * hours * 100) / 100

/** pay for one user in a month 'YYYY-MM': base salary + approved OT − approved unpaid leave days */
export async function monthlyPay(user, month, s) {
  s = s || (await getSettings())
  const ot = await db.prepare(`SELECT COALESCE(SUM(amount),0) v, COALESCE(SUM(hours),0) h FROM ot_requests
    WHERE user_id=? AND status='approved' AND substr(date,1,7)=?`).get(user.id, month)
  const unpaid = (await db.prepare(`SELECT COALESCE(SUM(days),0) v FROM leaves
    WHERE user_id=? AND status='approved' AND type='unpaid' AND substr(start_date,1,7)=?`).get(user.id, month)).v
  const deduction = Math.round((await rates(user, s)).daily * unpaid * 100) / 100
  return { base: user.salary, ot: ot.v, otHours: ot.h, deduction, total: Math.round((user.salary + ot.v - deduction) * 100) / 100 }
}
