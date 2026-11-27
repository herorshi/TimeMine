import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { toDateStr } from '../lib/time.js'

const router = Router()
router.use(auth)

const find = (id) => db.prepare('SELECT * FROM holidays WHERE id = ?').get(id)

async function parse(body, selfId = 0) {
  const date = String(body?.date || '')
  const name = String(body?.name || '').trim()
  // round-trip rejects impossible dates such as 2026-02-30
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || toDateStr(new Date(date + 'T00:00:00')) !== date) throw httpError(400, 'วันที่ไม่ถูกต้อง')
  if (!name) throw httpError(400, 'กรุณาระบุชื่อวันหยุด')
  if (await db.prepare('SELECT 1 FROM holidays WHERE date = ? AND id != ?').get(date, selfId)) throw httpError(409, 'มีวันหยุดในวันที่นี้แล้ว')
  return { date, name, year: Number(date.slice(0, 4)) }
}

router.get('/', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear()
  res.json(await db.prepare('SELECT * FROM holidays WHERE year = ? ORDER BY date').all(year))
})

// newest first; always offers the current and previous year
router.get('/years', async (_req, res) => {
  const now = new Date().getFullYear()
  const years = new Set([now, now - 1, ...(await db.prepare('SELECT DISTINCT year FROM holidays').all()).map((r) => r.year)])
  res.json([...years].sort((a, b) => b - a))
})

router.post('/', requireRole('admin'), async (req, res) => {
  const h = await parse(req.body)
  const { lastInsertRowid } = await db.prepare('INSERT INTO holidays (date, name, year) VALUES (@date, @name, @year)').run(h)
  res.status(201).json(await find(lastInsertRowid))
})

router.put('/:id', requireRole('admin'), async (req, res) => {
  const old = await find(req.params.id)
  if (!old) throw httpError(404, 'ไม่พบวันหยุด')
  const h = await parse({ ...old, ...req.body }, old.id)
  await db.prepare('UPDATE holidays SET date = @date, name = @name, year = @year WHERE id = @id').run({ ...h, id: old.id })
  res.json(await find(old.id))
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  if (!(await db.prepare('DELETE FROM holidays WHERE id = ?').run(req.params.id)).changes) throw httpError(404, 'ไม่พบวันหยุด')
  res.json({ ok: true })
})

export default router
