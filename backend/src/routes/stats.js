import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { getSettings } from '../lib/settings.js'
import { monthlyPay } from '../lib/payroll.js'
import { toDateStr, workingDaysBetween } from '../lib/time.js'
import { httpError } from '../lib/http.js'
import { sendXlsx } from './reports.js'

const router = Router()
router.use(auth)

const round2 = (n) => Math.round(n * 100) / 100
const pad = (n) => String(n).padStart(2, '0')

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const INT = '#,##0'
const DEC = '#,##0.00'

function overviewSheets({ year, months, totals, departments, top_late }) {
  const period = `ปี ${year + 543}`
  const monthCols = [['label', 'เดือน'], ['working_days', 'วันทำงาน', INT], ['headcount', 'พนักงาน', INT], ['checkins', 'เช็คอิน', INT],
    ['office', 'Office', INT], ['building', 'ตึก', INT], ['wfh', 'WFH', INT], ['late_count', 'มาสาย (ครั้ง)', INT],
    ['late_minutes', 'มาสาย (นาที)', INT], ['wfh_approved', 'WFH อนุมัติ', INT], ['wfh_rejected', 'WFH ไม่อนุมัติ', INT],
    ['warnings_issued', 'ใบเตือนที่ออก', INT], ['warnings_cancelled', 'ใบเตือนยกเลิก', INT], ['base', 'ฐานเงินเดือน', DEC],
    ['ot', 'ค่า OT', DEC], ['deduction', 'หัก', DEC], ['total', 'สุทธิ', DEC]]
  const deptKeys = ['headcount', 'checkins', 'late_count', 'late_minutes', 'warnings', 'payroll']
  return [
    {
      name: 'สรุปรายเดือน', title: `สรุปรายเดือน ${period}`, columns: monthCols,
      rows: months.map((m, i) => ({ ...m, ...m.payroll, label: MONTHS_TH[i] })),
      totals: { ...totals, ...totals.payroll, label: 'รวม' },
    },
    {
      name: 'แยกตามแผนก', title: `สรุปแยกตามแผนก ${period}`,
      columns: [['department', 'แผนก'], ['headcount', 'พนักงาน', INT], ['checkins', 'เช็คอิน', INT], ['late_count', 'มาสาย (ครั้ง)', INT],
        ['late_minutes', 'มาสาย (นาที)', INT], ['warnings', 'ใบเตือน', INT], ['payroll', 'เงินเดือนทั้งปี', DEC]],
      rows: departments,
      totals: { department: 'รวม', ...Object.fromEntries(deptKeys.map((k) => [k, round2(departments.reduce((s, d) => s + d[k], 0))])) },
    },
    {
      name: 'มาสายสูงสุด', title: `พนักงานมาสายสูงสุด ${period}`,
      columns: [['rank', 'อันดับ', INT], ['emp_code', 'รหัส'], ['name', 'ชื่อ'], ['department', 'แผนก'],
        ['late_count', 'มาสาย (ครั้ง)', INT], ['late_minutes', 'มาสาย (นาที)', INT]],
      rows: top_late.map((r, i) => ({ ...r, rank: i + 1 })),
    },
  ]
}

// GET /stats/overview?year=YYYY[&format=xlsx]
router.get('/overview', requireRole('executive'), async (req, res) => {
  const today = toDateStr()
  const year = Number(req.query.year ?? today.slice(0, 4))
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw httpError(400, 'ปีไม่ถูกต้อง')
  const y = String(year)
  const [settings, users, holidayRows] = await Promise.all([
    getSettings(),
    db.prepare('SELECT * FROM users WHERE active = 1').all(),
    db.prepare('SELECT date FROM holidays WHERE substr(date,1,4) = ?').all(y),
  ])
  const holidays = holidayRows.map((r) => r.date)
  const isWeekday = (d) => ![0, 6].includes(new Date(d + 'T00:00:00').getDay())
  const startedBy = (u, date) => !u.start_date || u.start_date <= date
  // working days in [from, to]: weekdays minus weekday holidays
  const workDays = (from, to) => (from > to ? 0
    : workingDaysBetween(from, to) - holidays.filter((d) => d >= from && d <= to && isWeekday(d)).length)

  const deptMap = new Map()
  const deptOf = (name) => {
    const key = name || 'ไม่ระบุแผนก'
    if (!deptMap.has(key)) deptMap.set(key, { department: key, headcount: 0, checkins: 0, late_count: 0, late_minutes: 0, warnings: 0, payroll: 0 })
    return deptMap.get(key)
  }
  for (const u of users) deptOf(u.department).headcount++

  const byMonth = async (sql) => new Map((await db.prepare(sql).all(y)).map((r) => [r.m, r]))
  const att = await byMonth(`SELECT substr(date,1,7) m,
      SUM(status != 'rejected') checkins,
      SUM(status != 'rejected' AND mode = 'office') office,
      SUM(status != 'rejected' AND mode = 'building') building,
      SUM(status != 'rejected' AND mode = 'wfh') wfh,
      SUM(status != 'rejected' AND late_minutes > 0) late_count,
      SUM(CASE WHEN status != 'rejected' THEN late_minutes ELSE 0 END) late_minutes,
      SUM(mode = 'wfh' AND status = 'approved') wfh_approved,
      SUM(mode = 'wfh' AND status = 'rejected') wfh_rejected
    FROM attendance WHERE substr(date,1,4) = ? GROUP BY m`)
  const issued = await byMonth(`SELECT substr(issued_at,1,7) m, COUNT(*) n FROM warnings WHERE substr(issued_at,1,4) = ? GROUP BY m`)
  const cancelled = await byMonth(`SELECT substr(cancelled_at,1,7) m, COUNT(*) n FROM warnings
    WHERE status = 'cancelled' AND substr(cancelled_at,1,4) = ? GROUP BY m`)

  // attendance rate = check-ins of active staff / (staff × elapsed working days)
  const activeCheckins = db.prepare(`SELECT COUNT(*) n FROM attendance a JOIN users u ON u.id = a.user_id
    WHERE u.active = 1 AND a.status != 'rejected' AND a.date BETWEEN ? AND ?`)
  // days before the first attendance record ever (system not in use yet) are not expected
  const since = (await db.prepare('SELECT MIN(date) d FROM attendance').get()).d
  let attended = 0
  let expected = 0

  const months = []
  for (let i = 1; i <= 12; i++) {
    const month = `${y}-${pad(i)}`
    const first = `${month}-01`
    const last = `${month}-${pad(new Date(year, i, 0).getDate())}`
    const future = first > today
    const staff = future ? [] : users.filter((u) => startedBy(u, last))
    let base = 0, ot = 0, deduction = 0
    const pays = await Promise.all(staff.map((u) => monthlyPay(u, month, settings)))
    for (const [j, u] of staff.entries()) {
      const p = pays[j]
      base += p.base; ot += p.ot; deduction += p.deduction
      deptOf(u.department).payroll += p.total
    }
    const to = last < today ? last : today
    if (!future && since) {
      // a day counts for a person only from their start date
      for (const u of staff) expected += workDays([first, since, u.start_date || first].sort().at(-1), to)
      attended += (await activeCheckins.get(first, to)).n
    }
    const a = att.get(month) || {}
    months.push({
      month,
      checkins: a.checkins || 0,
      office: a.office || 0,
      building: a.building || 0,
      wfh: a.wfh || 0,
      late_count: a.late_count || 0,
      late_minutes: a.late_minutes || 0,
      wfh_approved: a.wfh_approved || 0,
      wfh_rejected: a.wfh_rejected || 0,
      warnings_issued: issued.get(month)?.n || 0,
      warnings_cancelled: cancelled.get(month)?.n || 0,
      working_days: workDays(first, last),
      headcount: staff.length,
      payroll: { base: round2(base), ot: round2(ot), deduction: round2(deduction), total: round2(base + ot - deduction) },
    })
  }

  const totals = {}
  for (const k of ['checkins', 'office', 'building', 'wfh', 'late_count', 'late_minutes', 'wfh_approved', 'wfh_rejected', 'warnings_issued', 'warnings_cancelled', 'working_days'])
    totals[k] = months.reduce((s, m) => s + m[k], 0)
  totals.payroll = {}
  for (const k of ['base', 'ot', 'deduction', 'total']) totals.payroll[k] = round2(months.reduce((s, m) => s + m.payroll[k], 0))
  totals.attendance_rate = expected ? Math.min(100, Math.round((attended / expected) * 1000) / 10) : 0

  const deptAtt = await db.prepare(`SELECT u.department d, COUNT(*) checkins, SUM(a.late_minutes > 0) late_count, SUM(a.late_minutes) late_minutes
    FROM attendance a JOIN users u ON u.id = a.user_id
    WHERE a.status != 'rejected' AND substr(a.date,1,4) = ? GROUP BY u.department`).all(y)
  for (const r of deptAtt) {
    const d = deptOf(r.d)
    d.checkins += r.checkins; d.late_count += r.late_count; d.late_minutes += r.late_minutes
  }
  const deptWarn = await db.prepare(`SELECT u.department d, COUNT(*) n FROM warnings w JOIN users u ON u.id = w.user_id
    WHERE w.status = 'active' AND substr(w.issued_at,1,4) = ? GROUP BY u.department`).all(y)
  for (const r of deptWarn) deptOf(r.d).warnings += r.n

  const topLate = await db.prepare(`SELECT u.id user_id, u.emp_code, u.name, u.department,
      COUNT(*) late_count, SUM(a.late_minutes) late_minutes
    FROM attendance a JOIN users u ON u.id = a.user_id
    WHERE a.status != 'rejected' AND a.late_minutes > 0 AND substr(a.date,1,4) = ?
    GROUP BY u.id ORDER BY late_count DESC, late_minutes DESC LIMIT 10`).all(y)

  // every year from the earliest record to the current year, at least the last 3 (floor 2000 = what ?year accepts)
  const firstDate = (await db.prepare(`SELECT MIN(d) d FROM (
    SELECT MIN(date) d FROM attendance
    UNION ALL SELECT MIN(date) FROM ot_requests
    UNION ALL SELECT MIN(start_date) FROM leaves)`).get()).d
  const thisYear = Number(today.slice(0, 4))
  const minYear = Math.max(2000, Math.min(thisYear - 2, Number(firstDate?.slice(0, 4) || thisYear)))
  const years = Array.from({ length: thisYear - minYear + 1 }, (_, i) => thisYear - i)

  const data = {
    year,
    years,
    headcount: users.length,
    months,
    totals,
    departments: [...deptMap.values()].map((d) => ({ ...d, payroll: round2(d.payroll) })),
    top_late: topLate,
  }
  if (req.query.format === 'xlsx') return await sendXlsx(res, `overview_${year}`, overviewSheets(data))
  res.json(data)
})

export default router
