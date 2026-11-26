import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { toDateStr } from '../lib/time.js'

const router = Router()
router.use(auth)

const find = (id) => db.prepare('SELECT * FROM holidays WHERE id = ?').get(id)

function parse(body, selfId = 0) {
  const date = String(body?.date || '')
  const name = String(body?.name || '').trim()
  // round-trip rejects impossible dates such as 2026-02-30
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || toDateStr(new Date(date + 'T00:00:00')) !== date) throw httpError(400, 'วันที่ไม่ถูกต้อง')
  if (!name) throw httpError(400, 'กรุณาระบุชื่อวันหยุด')
  if (db.prepare('SELECT 1 FROM holidays WHERE date = ? AND id != ?').get(date, selfId)) throw httpError(409, 'มีวันหยุดในวันที่นี้แล้ว')
  return { date, name, year: Number(date.slice(0, 4)) }
}

router.get('/', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear()
  res.json(db.prepare('SELECT * FROM holidays WHERE year = ? ORDER BY date').all(year))
})

// newest first; always offers the current and previous year
router.get('/years', (_req, res) => {
  const now = new Date().getFullYear()
  const years = new Set([now, now - 1, ...db.prepare('SELECT DISTINCT year FROM holidays').all().map((r) => r.year)])
  res.json([...years].sort((a, b) => b - a))
})

router.post('/', requireRole('admin'), (req, res) => {
  const h = parse(req.body)
  const { lastInsertRowid } = db.prepare('INSERT INTO holidays (date, name, year) VALUES (@date, @name, @year)').run(h)
  res.status(201).json(find(lastInsertRowid))
})

router.put('/:id', requireRole('admin'), (req, res) => {
  const old = find(req.params.id)
  if (!old) throw httpError(404, 'ไม่พบวันหยุด')
  const h = parse({ ...old, ...req.body }, old.id)
  db.prepare('UPDATE holidays SET date = @date, name = @name, year = @year WHERE id = @id').run({ ...h, id: old.id })
  res.json(find(old.id))
})

router.delete('/:id', requireRole('admin'), (req, res) => {
  if (!db.prepare('DELETE FROM holidays WHERE id = ?').run(req.params.id).changes) throw httpError(404, 'ไม่พบวันหยุด')
  res.json({ ok: true })
})

export default router
