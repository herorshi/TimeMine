import { Router } from 'express'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../lib/settings.js'

const router = Router()
router.use(auth)

const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const between = (min, max) => (v) => v !== '' && Number(v) >= min && Number(v) <= max
const RULES = {
  company_name: [(v) => v.length > 0, 'กรุณาระบุชื่อบริษัท'],
  work_start: [isTime, 'เวลาเข้างานไม่ถูกต้อง'],
  work_end: [isTime, 'เวลาเลิกงานไม่ถูกต้อง'],
  late_grace_min: [between(0, 240), 'นาทีผ่อนผันต้องอยู่ระหว่าง 0-240'],
  work_days_per_month: [between(1, 31), 'วันทำงานต่อเดือนต้องอยู่ระหว่าง 1-31'],
  work_hours_per_day: [between(1, 24), 'ชั่วโมงทำงานต่อวันต้องอยู่ระหว่าง 1-24'],
  ot_multiplier: [between(0, 10), 'ตัวคูณ OT ต้องอยู่ระหว่าง 0-10'],
  face_threshold: [between(0.1, 1), 'เกณฑ์สแกนหน้าต้องอยู่ระหว่าง 0.1-1'],
}

router.get('/', (_req, res) => res.json(getSettings()))

router.put('/', requireRole('admin'), (req, res) => {
  const patch = {}
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (req.body?.[k] === undefined) continue
    const v = String(req.body[k] ?? '').trim()
    const [valid, message] = RULES[k]
    if (!valid(v)) throw httpError(400, message)
    patch[k] = v
  }
  res.json(setSettings(patch))
})

export default router
