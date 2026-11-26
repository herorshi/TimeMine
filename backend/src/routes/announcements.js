import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { toDateStr } from '../lib/time.js'

const router = Router()
router.use(auth)

const TYPES = ['news', 'event']
const SELECT = 'SELECT a.*, u.name AS author_name FROM announcements a LEFT JOIN users u ON u.id = a.author_id'
const find = (id) => db.prepare(`${SELECT} WHERE a.id = ?`).get(id)

function parse(body) {
  const title = String(body?.title || '').trim()
  const text = String(body?.body || '').trim()
  const type = body?.type || 'news'
  if (!title) throw httpError(400, 'กรุณาระบุหัวข้อ')
  if (!text) throw httpError(400, 'กรุณาระบุรายละเอียด')
  if (!TYPES.includes(type)) throw httpError(400, 'ประเภทประกาศไม่ถูกต้อง')
  const event_date = type === 'event' ? String(body?.event_date || '') : null
  if (type === 'event' && (!/^\d{4}-\d{2}-\d{2}$/.test(event_date) || toDateStr(new Date(event_date + 'T00:00:00')) !== event_date)) {
    throw httpError(400, 'กรุณาระบุวันที่จัดกิจกรรม')
  }
  return { title, body: text, type, event_date, pinned: body?.pinned ? 1 : 0 }
}

router.get('/', async (req, res) => {
  const type = TYPES.includes(req.query.type) ? req.query.type : null
  res.json(await db.prepare(`${SELECT} WHERE (@type IS NULL OR a.type = @type) ORDER BY a.pinned DESC, a.created_at DESC, a.id DESC`).all({ type }))
})

router.post('/', requireRole('admin'), async (req, res) => {
  const a = parse(req.body)
  const { lastInsertRowid } = await db.prepare(
    'INSERT INTO announcements (title, body, type, event_date, pinned, author_id) VALUES (@title, @body, @type, @event_date, @pinned, @author_id)',
  ).run({ ...a, author_id: req.user.id })
  res.status(201).json(await find(lastInsertRowid))
})

// partial body allowed (pin toggle sends only { pinned })
router.put('/:id', requireRole('admin'), async (req, res) => {
  const old = await find(req.params.id)
  if (!old) throw httpError(404, 'ไม่พบประกาศ')
  const a = parse({ ...old, ...req.body })
  await db.prepare('UPDATE announcements SET title = @title, body = @body, type = @type, event_date = @event_date, pinned = @pinned WHERE id = @id').run({ ...a, id: old.id })
  res.json(await find(old.id))
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  if (!(await db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id)).changes) throw httpError(404, 'ไม่พบประกาศ')
  res.json({ ok: true })
})

export default router
