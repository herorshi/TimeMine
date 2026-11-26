// Every report returns { columns: [[key, label]], rows, summary }; `format=csv` sends the same columns and rows.
import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { toDateStr } from '../lib/time.js'
import { getSettings } from '../lib/settings.js'
import { monthlyPay } from '../lib/payroll.js'
import { LEAVE_TYPES } from '../lib/constants.js'

const router = Router()
router.use(auth, requireRole('admin'))

const STATUS_TH = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิก' }
const round = (n) => Math.round(n * 100) / 100
const sum = (rows, key) => round(rows.reduce((s, r) => s + Number(r[key] || 0), 0))

function range(q) {
  const today = toDateStr()
  const from = String(q.from || today.slice(0, 8) + '01')
  const to = String(q.to || today)
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d)
  if (!ok(from) || !ok(to) || from > to) throw httpError(400, 'ช่วงวันที่ไม่ถูกต้อง')
  return { from, to }
}

function csvCell(v) {
  let s = String(v ?? '')
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s // block spreadsheet formula injection
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function send(req, res, name, data) {
  if (req.query.format !== 'csv') return res.json(data)
  const lines = [data.columns.map(([, label]) => label), ...data.rows.map((r) => data.columns.map(([key]) => r[key]))]
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`)
  res.send('﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n'))
}

router.get('/attendance', (req, res) => {
  const { from, to } = range(req.query)
  const userId = Number(req.query.user_id) || null
  // rejected check-ins do not count; deactivated users appear only when they have records
  const rows = db.prepare(`SELECT u.emp_code, u.name, u.department,
      COUNT(a.id) days,
      COALESCE(SUM(a.mode = 'office'),0) office,
      COALESCE(SUM(a.mode = 'building'),0) building,
      COALESCE(SUM(a.mode = 'wfh'),0) wfh,
      COALESCE(SUM(a.status = 'pending'),0) pending,
      COALESCE(SUM(a.late_minutes > 0),0) late_count,
      COALESCE(SUM(a.late_minutes),0) late_minutes
    FROM users u LEFT JOIN attendance a ON a.user_id = u.id AND a.date BETWEEN ? AND ? AND a.status != 'rejected'
    WHERE (? IS NULL OR u.id = ?)
    GROUP BY u.id HAVING u.active = 1 OR COUNT(a.id) > 0 ORDER BY u.emp_code`).all(from, to, userId, userId)
  send(req, res, `attendance_${from}_${to}`, {
    columns: [['emp_code', 'รหัส'], ['name', 'ชื่อ'], ['department', 'แผนก'], ['days', 'วันที่เข้างาน'], ['office', 'Office'],
      ['building', 'ตึก'], ['wfh', 'WFH'], ['pending', 'รออนุมัติ'], ['late_count', 'มาสาย (ครั้ง)'], ['late_minutes', 'มาสาย (นาที)']],
    rows,
    summary: { employees: rows.length, days: sum(rows, 'days'), wfh: sum(rows, 'wfh'), late_count: sum(rows, 'late_count'), late_minutes: sum(rows, 'late_minutes') },
  })
})

router.get('/leaves', (req, res) => {
  const { from, to } = range(req.query)
  const rows = db.prepare(`SELECT u.emp_code, u.name, u.department, l.type, l.start_date, l.end_date, l.days, l.reason, l.status
    FROM leaves l JOIN users u ON u.id = l.user_id
    WHERE l.start_date <= ? AND l.end_date >= ? ORDER BY l.start_date, u.emp_code`).all(to, from)
    .map((r) => ({ ...r, type_label: LEAVE_TYPES[r.type]?.label || r.type, status_label: STATUS_TH[r.status] || r.status }))
  const approved = rows.filter((r) => r.status === 'approved')
  send(req, res, `leaves_${from}_${to}`, {
    columns: [['emp_code', 'รหัส'], ['name', 'ชื่อ'], ['department', 'แผนก'], ['type_label', 'ประเภท'], ['start_date', 'เริ่ม'],
      ['end_date', 'สิ้นสุด'], ['days', 'จำนวนวัน'], ['reason', 'เหตุผล'], ['status_label', 'สถานะ']],
    rows,
    summary: { requests: rows.length, approved: approved.length, approved_days: sum(approved, 'days'), pending: rows.filter((r) => r.status === 'pending').length },
  })
})

router.get('/ot', (req, res) => {
  const { from, to } = range(req.query)
  const rows = db.prepare(`SELECT u.emp_code, u.name, u.department, o.date, o.start_time, o.end_time, o.hours, o.amount, o.reason, o.status
    FROM ot_requests o JOIN users u ON u.id = o.user_id
    WHERE o.date BETWEEN ? AND ? ORDER BY o.date, u.emp_code`).all(from, to)
    .map((r) => ({ ...r, status_label: STATUS_TH[r.status] || r.status }))
  const approved = rows.filter((r) => r.status === 'approved')
  send(req, res, `ot_${from}_${to}`, {
    columns: [['emp_code', 'รหัส'], ['name', 'ชื่อ'], ['department', 'แผนก'], ['date', 'วันที่'], ['start_time', 'เริ่ม'],
      ['end_time', 'สิ้นสุด'], ['hours', 'ชั่วโมง'], ['amount', 'ค่า OT (บาท)'], ['reason', 'เหตุผล'], ['status_label', 'สถานะ']],
    rows,
    summary: { requests: rows.length, approved_hours: sum(approved, 'hours'), approved_amount: sum(approved, 'amount'), pending: rows.filter((r) => r.status === 'pending').length },
  })
})

router.get('/payroll', (req, res) => {
  const month = String(req.query.month || toDateStr().slice(0, 7))
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw httpError(400, 'เดือนไม่ถูกต้อง')
  const settings = getSettings()
  // staff not yet started in that month are excluded; deactivated users appear only when they have OT/unpaid leave
  const rows = db.prepare('SELECT * FROM users ORDER BY emp_code').all()
    .filter((u) => !u.start_date || u.start_date.slice(0, 7) <= month)
    .map((u) => {
      const p = monthlyPay(u, month, settings)
      return { active: u.active, emp_code: u.emp_code, name: u.name, department: u.department, base: p.base, ot_hours: p.otHours, ot: p.ot, deduction: p.deduction, total: p.total }
    })
    .filter((r) => r.active || r.ot > 0 || r.deduction > 0)
    .map(({ active, ...r }) => r)
  send(req, res, `payroll_${month}`, {
    columns: [['emp_code', 'รหัส'], ['name', 'ชื่อ'], ['department', 'แผนก'], ['base', 'เงินเดือน'], ['ot_hours', 'OT (ชม.)'],
      ['ot', 'ค่า OT'], ['deduction', 'หักลาไม่รับเงิน'], ['total', 'รวมสุทธิ']],
    rows,
    summary: { employees: rows.length, base: sum(rows, 'base'), ot: sum(rows, 'ot'), deduction: sum(rows, 'deduction'), total: sum(rows, 'total') },
  })
})

export default router
