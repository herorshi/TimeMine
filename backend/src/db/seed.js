import '../tz.js'
// Seed demo data. Run: npm run seed  (wipes and refills every table)
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { db } from './index.js'
import { DEFAULT_SETTINGS } from '../lib/settings.js'
import { toDateStr, lateMinutes } from '../lib/time.js'
import { otAmount } from '../lib/payroll.js'
import { attendanceScore, totalScore, grade } from '../lib/kpi.js'

let seed = 42
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const pick = (a) => a[Math.floor(rnd() * a.length)]
const pad = (n) => String(n).padStart(2, '0')

/** one multi-row INSERT per chunk: few round trips on a remote DB */
async function insertMany(table, cols, rows, size = 200) {
  const one = `(${cols.split(',').map(() => '?').join(',')})`
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    await db.prepare(`INSERT INTO ${table} (${cols}) VALUES ${chunk.map(() => one).join(',')}`).run(chunk.flat())
  }
}

const hash = (p) => bcrypt.hashSync(p, 8)
const users = [
  ['A001', 'admin@timemint.local', 'admin123', 'สมพร ใจดี', 'F', 'admin', 'HR', 'HR Manager', 45000],
  ['X001', 'exec@timemint.local', 'exec123', 'วิชัย ผู้นำ', 'M', 'executive', 'Management', 'CEO', 150000],
  ['E001', 'somchai@timemint.local', 'emp123', 'สมชาย รักงาน', 'M', 'employee', 'Engineering', 'Developer', 38000],
  ['E002', 'somsri@timemint.local', 'emp123', 'สมศรี ขยัน', 'F', 'employee', 'Engineering', 'QA Engineer', 32000],
  ['E003', 'anan@timemint.local', 'emp123', 'อนันต์ มั่นคง', 'M', 'employee', 'Sales', 'Sales Executive', 28000],
  ['E004', 'malee@timemint.local', 'emp123', 'มาลี สดใส', 'F', 'employee', 'Marketing', 'Designer', 30000],
  ['E005', 'kittisak@timemint.local', 'emp123', 'กิตติศักดิ์ เก่งกาจ', 'M', 'employee', 'Engineering', 'Senior Developer', 55000],
  ['E006', 'pranee@timemint.local', 'emp123', 'ปราณี ตั้งใจ', 'F', 'employee', 'Finance', 'Accountant', 34000],
  ['E007', 'thana@timemint.local', 'emp123', 'ธนา ร่ำรวย', 'M', 'employee', 'Sales', 'Sales Manager', 48000],
  ['E008', 'nittaya@timemint.local', 'emp123', 'นิตยา งามตา', 'F', 'employee', 'HR', 'HR Officer', 26000],
]
const userRows = users.map(([code, email, pw, name, g, role, dept, pos, sal]) =>
  [code, email, hash(pw), name, g, role, dept, pos, sal, `08${Math.floor(10000000 + rnd() * 89999999)}`,
    `20${pad(18 + Math.floor(rnd() * 6))}-${pad(1 + Math.floor(rnd() * 12))}-01`, `19${85 + Math.floor(rnd() * 14)}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`])

// KPI demo profile per employee: how often late / absent, then quality, productivity, teamwork, responsibility.
// Last year has no attendance rows, so its attendance score is given here.
const kpiProfiles = {
  A001: { late: 0.02, absent: 0.004, now: [5, 4, 4, 4], nowStatus: 'draft', prev: [4, 4, 5, 4], prevAtt: 91.5 },
  E001: { late: 0.01, absent: 0, now: [5, 5, 5, 5], nowStatus: 'final', prev: [5, 5, 4, 5], prevAtt: 96 },
  E002: { late: 0.02, absent: 0.004, now: [5, 4, 5, 4], nowStatus: 'final', prev: [5, 5, 5, 5], prevAtt: 94.5 },
  E003: { late: 0.08, absent: 0.012, now: [3, 3, 4, 3], nowStatus: 'final', prev: [3, 4, 3, 3], prevAtt: 72 },
  E004: { late: 0.04, absent: 0.008, now: [4, 4, 4, 3], nowStatus: 'draft', prev: [4, 4, 4, 4], prevAtt: 85 },
  E005: { late: 0.01, absent: 0, now: [5, 5, 5, 5], nowStatus: 'final', prev: [5, 5, 4, 4], prevAtt: 93 },
  E006: { late: 0.03, absent: 0.004, now: [4, 5, 4, 4], nowStatus: 'final', prev: [4, 4, 4, 3], prevAtt: 88 },
  E007: { late: 0.05, absent: 0.008, now: [4, 4, 4, 4], nowStatus: 'final', prev: [3, 3, 3, 3], prevAtt: 64 },
  E008: { late: 0.1, absent: 0.016, now: [3, 2, 3, 2], nowStatus: 'draft', prev: [2, 2, 3, 2], prevAtt: 55 },
}

async function seedAll() {
for (const t of ['kpi_evaluations', 'warnings', 'announcements', 'holidays', 'ot_requests', 'leaves', 'attendance', 'settings', 'users', 'sqlite_sequence'])
  await db.prepare(`DELETE FROM ${t}`).run()

await insertMany('settings', 'key,value', Object.entries(DEFAULT_SETTINGS))
await insertMany('users', 'emp_code,email,password_hash,name,gender,role,department,position,salary,phone,start_date,birthdate', userRows)
const all = await db.prepare('SELECT * FROM users ORDER BY id').all()
const admin = all.find((u) => u.role === 'admin')

// Thai public holidays
const hol = {
  '01-01': 'วันขึ้นปีใหม่', '04-06': 'วันจักรี', '04-13': 'วันสงกรานต์', '04-14': 'วันสงกรานต์', '04-15': 'วันสงกรานต์',
  '05-01': 'วันแรงงานแห่งชาติ', '05-04': 'วันฉัตรมงคล', '06-03': 'วันเฉลิมพระชนมพรรษาพระราชินี', '07-28': 'วันเฉลิมพระชนมพรรษา ร.10',
  '08-12': 'วันแม่แห่งชาติ', '10-13': 'วันนวมินทรมหาราช', '10-23': 'วันปิยมหาราช', '12-05': 'วันพ่อแห่งชาติ',
  '12-10': 'วันรัฐธรรมนูญ', '12-31': 'วันสิ้นปี',
}
// Buddhist holidays move every year (lunar calendar)
const buddhist = {
  2024: ['02-24', '05-22', '07-20', '07-21'],
  2025: ['02-12', '05-11', '07-10', '07-11'],
  2026: ['03-03', '05-31', '07-29', '07-30'],
}
const buddhistNames = ['วันมาฆบูชา', 'วันวิสาขบูชา', 'วันอาสาฬหบูชา', 'วันเข้าพรรษา']
const holidays = new Map() // date -> name
for (const [y, dates] of Object.entries(buddhist)) {
  for (const [md, name] of Object.entries(hol)) holidays.set(`${y}-${md}`, name)
  dates.forEach((md, i) => holidays.set(`${y}-${md}`, buddhistNames[i]))
}
// substitute day for each weekend holiday: next working day that is not already a holiday
const isWeekend = (d) => [0, 6].includes(d.getDay())
for (const [date, name] of [...holidays].sort(([a], [b]) => a.localeCompare(b))) {
  const d = new Date(`${date}T00:00:00`)
  if (!isWeekend(d)) continue
  do d.setDate(d.getDate() + 1)
  while (isWeekend(d) || holidays.has(toDateStr(d)))
  holidays.set(toDateStr(d), `วันหยุดชดเชย${name}`)
}
await insertMany('holidays', 'date,name,year', [...holidays].map(([date, name]) => [date, name, Number(date.slice(0, 4))]))
const holidaySet = new Set(holidays.keys())

// Attendance for working days: the last ~6 months, extended back to 1 January so this year's KPI is meaningful
const s = DEFAULT_SETTINGS
const attRows = []
const today = new Date()
const start = new Date(today); start.setMonth(start.getMonth() - 6)
const jan1 = new Date(today.getFullYear(), 0, 1)
if (jan1 < start) start.setTime(jan1.getTime())
for (let d = new Date(start); d < today; d.setDate(d.getDate() + 1)) {
  const ds = toDateStr(d)
  if ([0, 6].includes(d.getDay()) || holidaySet.has(ds) || ds === toDateStr(today)) continue
  for (const u of all) {
    const profile = kpiProfiles[u.emp_code] || { late: 0.03, absent: 0.004 }
    if (rnd() < profile.absent) continue // absent
    const r = rnd()
    const mode = r < 0.55 ? 'office' : r < 0.85 ? 'building' : 'wfh'
    const lateish = rnd() < profile.late
    const mins = lateish ? 9 * 60 + 6 + Math.floor(rnd() * 50) : 8 * 60 + 15 + Math.floor(rnd() * 50)
    const ci = `${ds} ${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00`
    const co = `${ds} ${pad(17 + Math.floor(rnd() * 3))}:${pad(Math.floor(rnd() * 60))}:00`
    const status = mode === 'wfh' ? (rnd() < 0.99 ? 'approved' : 'rejected') : 'approved'
    attRows.push([u.id, ds, mode, ci, co, status, lateMinutes(ci, s), mode === 'building' ? 1 : 0, mode === 'building' ? 0.32 : null,
      mode === 'wfh' ? admin.id : null, mode === 'wfh' ? ci : null, status === 'rejected' ? 'ไม่มีงานที่ต้องทำจากบ้านวันนั้น' : null])
  }
}
await insertMany('attendance', 'user_id,date,mode,check_in_at,check_out_at,status,late_minutes,face_verified,face_distance,reviewed_by,reviewed_at,reject_reason', attRows)

// Leaves
const leaveRows = []
const emps = all.filter((u) => u.role === 'employee')
for (const u of emps) for (let i = 0; i < 5; i++) {
  const d = new Date(today); d.setDate(d.getDate() - Math.floor(rnd() * 170) + 10)
  if ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 2)
  const ds = toDateStr(d)
  const types = u.gender === 'M' ? ['sick', 'personal', 'vacation', 'unpaid', 'sick'] : ['sick', 'personal', 'vacation', 'menstrual', 'unpaid']
  const type = types[i]
  const st = d > today ? 'pending' : pick(['approved', 'approved', 'approved', 'rejected'])
  leaveRows.push([u.id, type, ds, ds, 1, pick(['ไม่สบาย', 'ธุระส่วนตัว', 'พักผ่อนกับครอบครัว', 'ไปต่างจังหวัด']), st,
    st === 'rejected' ? 'ช่วงนี้งานเร่ง กรุณาเลื่อน' : null, st === 'pending' ? null : admin.id, st === 'pending' ? null : ds])
}
await insertMany('leaves', 'user_id,type,start_date,end_date,days,reason,status,reject_reason,reviewed_by,reviewed_at', leaveRows)

// OT
const otRows = []
for (const u of emps) for (let i = 0; i < 8; i++) {
  const d = new Date(today); d.setDate(d.getDate() - Math.floor(rnd() * 175) + 3)
  const ds = toDateStr(d)
  const h = 1 + Math.floor(rnd() * 4)
  const st = d > today ? 'pending' : pick(['approved', 'approved', 'approved', 'rejected', 'pending'])
  otRows.push([u.id, ds, '18:00', `${18 + h}:00`, h, pick(['ปิดงาน sprint', 'งานด่วนลูกค้า', 'เตรียมงานนำเสนอ', 'ตรวจสอบระบบ']), st,
    st === 'approved' ? await otAmount(u, h, s) : 0, st === 'pending' ? null : admin.id, st === 'pending' ? null : ds, st === 'rejected' ? 'ไม่ได้รับมอบหมายงานล่วงหน้า' : null])
}
await insertMany('ot_requests', 'user_id,date,start_time,end_time,hours,reason,status,amount,reviewed_by,reviewed_at,reject_reason', otRows)

// Warnings
const warnReasons = {
  late: 'มาสายเกิน 5 ครั้งในเดือน',
  absent: 'ขาดงานโดยไม่แจ้งล่วงหน้า',
  performance: 'ส่งงานล่าช้ากว่ากำหนด',
  conduct: 'ไม่ปฏิบัติตามระเบียบบริษัท',
}
const wRows = []
for (let i = 0; i < 9; i++) {
  const u = pick(emps)
  const d = new Date(today); d.setDate(d.getDate() - Math.floor(rnd() * 170))
  const ds = `${toDateStr(d)} 10:00:00`
  const cancelled = rnd() < 0.2
  const level = pick(['verbal', 'written', 'written', 'final'])
  const category = pick(['late', 'late', 'absent', 'conduct', 'performance'])
  wRows.push([u.id, level, category, warnReasons[category], admin.id, ds,
    cancelled ? 'cancelled' : 'active', cancelled ? 'ตรวจสอบแล้วมีเหตุอันสมควร' : null, cancelled ? admin.id : null, cancelled ? ds : null])
}
await insertMany('warnings', 'user_id,level,category,reason,issued_by,issued_at,status,cancel_reason,cancelled_by,cancelled_at', wRows)

// Announcements
const annRows = []
const insA = (...row) => annRows.push(row)
const exec = all.find((u) => u.role === 'executive')
const future = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return toDateStr(d) }
const past = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return `${toDateStr(d)} 09:00:00` }
insA('งานเลี้ยงปีใหม่ 2570', 'ขอเชิญพนักงานทุกท่านร่วมงานเลี้ยงปีใหม่ ณ ห้องประชุมใหญ่ ชั้น 5 เวลา 18:00 น. เป็นต้นไป มีของรางวัลจับฉลากมากมาย', 'event', future(30), 1, exec.id, past(2))
insA('อบรม Security Awareness', 'พนักงานทุกคนต้องเข้าอบรมความปลอดภัยไซเบอร์ออนไลน์ ภายในสิ้นเดือนนี้', 'event', future(10), 0, admin.id, past(5))
insA('ปรับเวลาเข้างานช่วงปลายปี', 'ตั้งแต่ 1 ธันวาคม เวลาเข้างานยังคงเป็น 09:00 น. โปรดลงเวลาก่อนเวลาเพื่อหลีกเลี่ยงการมาสาย', 'news', null, 0, admin.id, past(8))
insA('ผลประกอบการไตรมาส 3', 'บริษัทมีผลประกอบการเติบโต 18% ขอบคุณพนักงานทุกท่านที่ร่วมแรงร่วมใจ', 'news', null, 0, exec.id, past(20))

await insertMany('announcements', 'title,body,type,event_date,pinned,author_id,created_at', annRows)

// KPI evaluations: last year all final, this year a mix of final / draft
const year = today.getFullYear()
const kpiRows = []
for (const u of all) {
  const p = kpiProfiles[u.emp_code]
  if (!p) continue
  const add = (y, att, [quality, productivity, teamwork, responsibility], status, at) => {
    const total = totalScore({ attendance_score: att, quality, productivity, teamwork, responsibility })
    kpiRows.push([u.id, y, att, quality, productivity, teamwork, responsibility, total, grade(total),
      total >= 80 ? 'ผลงานดี รักษามาตรฐานต่อไป' : 'ควรปรับปรุงการตรงต่อเวลาและคุณภาพงาน',
      status, u.role === 'admin' ? exec.id : admin.id, at, at])
  }
  add(year - 1, p.prevAtt, p.prev, 'final', `${year - 1}-12-20 10:00:00`)
  add(year, (await attendanceScore(u, year)).score, p.now, p.nowStatus, `${toDateStr(today)} 10:00:00`)
}
await insertMany('kpi_evaluations', 'user_id,year,attendance_score,quality,productivity,teamwork,responsibility,total_score,grade,comment,status,evaluator_id,created_at,updated_at', kpiRows)
return all.length
}

await db.ready()
const count = await db.transaction(seedAll)()

console.log(`Seeded ${count} users. Logins: admin@timemint.local/admin123, exec@timemint.local/exec123, somchai@timemint.local/emp123, somsri@timemint.local/emp123`)
