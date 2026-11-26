import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { toDateStr } from '../lib/time.js'
import { saveImage, deleteImage, isBlobUrl } from '../lib/storage.js'

const router = Router()
router.use(auth)

const TYPES = ['news', 'event']
const SELECT = 'SELECT a.*, u.name AS author_name FROM announcements a LEFT JOIN users u ON u.id = a.author_id'
const find = (id) => db.prepare(`${SELECT} WHERE a.id = ?`).get(id)

// 1.5 MB decoded; its base64 form still fits the 2mb JSON body limit
const MAX_IMAGE_BYTES = 1_500_000
const MAGIC = {
  'image/jpeg': (b) => b.subarray(0, 3).toString('hex') === 'ffd8ff',
  'image/png': (b) => b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
  'image/webp': (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.toString('latin1', 0, 6)),
}

function decodeImage(dataUrl) {
  const m = typeof dataUrl === 'string' && /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
  if (!m) throw httpError(400, 'รองรับเฉพาะรูปภาพ JPEG, PNG, WebP หรือ GIF')
  const buffer = Buffer.from(m[2], 'base64')
  if (buffer.length > MAX_IMAGE_BYTES) throw httpError(400, 'รูปภาพต้องมีขนาดไม่เกิน 1.5 MB')
  if (!MAGIC[m[1]](buffer)) throw httpError(400, 'ไฟล์รูปภาพไม่ถูกต้อง')
  return { buffer, contentType: m[1] }
}

/** the image_url to store: unchanged unless the body removes or replaces it */
async function nextImage(body, current = null) {
  if (body?.remove_image === true) return null
  const url = body?.image_url
  if (!url || url === current) return current
  if (typeof url === 'string' && url.startsWith('data:')) {
    const { buffer, contentType } = decodeImage(url)
    return saveImage(buffer, contentType)
  }
  if (typeof url !== 'string' || !isBlobUrl(url)) throw httpError(400, 'ลิงก์รูปภาพไม่ถูกต้อง')
  return url
}

/** delete a blob once no announcement points at it any more */
async function dropImage(url) {
  if (url && !(await db.prepare('SELECT 1 FROM announcements WHERE image_url = ? LIMIT 1').get(url))) await deleteImage(url)
}

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

router.post('/image', requireRole('admin'), async (req, res) => {
  const { buffer, contentType } = decodeImage(req.body?.dataUrl)
  res.status(201).json({ url: await saveImage(buffer, contentType) })
})

router.post('/', requireRole('admin'), async (req, res) => {
  const a = parse(req.body)
  const image_url = await nextImage(req.body)
  const { lastInsertRowid } = await db.prepare(
    'INSERT INTO announcements (title, body, type, event_date, pinned, image_url, author_id) VALUES (@title, @body, @type, @event_date, @pinned, @image_url, @author_id)',
  ).run({ ...a, image_url, author_id: req.user.id })
  res.status(201).json(await find(lastInsertRowid))
})

// partial body allowed (pin toggle sends only { pinned })
router.put('/:id', requireRole('admin'), async (req, res) => {
  const old = await find(req.params.id)
  if (!old) throw httpError(404, 'ไม่พบประกาศ')
  const a = parse({ ...old, ...req.body })
  const image_url = await nextImage(req.body, old.image_url)
  await db.prepare('UPDATE announcements SET title = @title, body = @body, type = @type, event_date = @event_date, pinned = @pinned, image_url = @image_url WHERE id = @id').run({ ...a, image_url, id: old.id })
  if (image_url !== old.image_url) await dropImage(old.image_url)
  res.json(await find(old.id))
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const old = await find(req.params.id)
  if (!old) throw httpError(404, 'ไม่พบประกาศ')
  await db.prepare('DELETE FROM announcements WHERE id = ?').run(old.id)
  await dropImage(old.image_url)
  res.json({ ok: true })
})

export default router
