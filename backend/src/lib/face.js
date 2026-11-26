import { db } from '../db/index.js'
import { httpError } from './http.js'
import { getSettings } from './settings.js'

export const euclidean = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0))
export const isDescriptor = (d) => Array.isArray(d) && d.length === 128 && d.every((v) => typeof v === 'number')

const MARGIN = 0.06 // second best must be at least this much further than the best
const REPLAY_DISTANCE = 0.02
const REPLAY_KEEP = 5
const MAX_PHOTO_BYTES = 1024 * 1024

// last accepted scans per user (replay guard); in the DB so it holds across serverless instances
db.exec(`CREATE TABLE IF NOT EXISTS face_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  descriptor TEXT NOT NULL
);`)

const round = (n) => Math.round(n * 1000) / 1000

export function readDescriptor(d) {
  if (!isDescriptor(d) || !d.every(Number.isFinite)) throw httpError(400, 'ข้อมูลใบหน้าไม่ถูกต้อง กรุณาสแกนใหม่')
  return d
}

/** JPEG data URL, at most 1 MB decoded, checked by magic bytes → Buffer */
export function readPhoto(dataUrl) {
  const prefix = 'data:image/jpeg;base64,'
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) throw httpError(400, 'กรุณาแนบรูปถ่ายใบหน้า (JPEG)')
  const b64 = dataUrl.slice(prefix.length)
  if (b64.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) throw httpError(400, 'รูปถ่ายต้องมีขนาดไม่เกิน 1 MB')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw httpError(400, 'ไฟล์รูปถ่ายไม่ถูกต้อง')
  const buf = Buffer.from(b64, 'base64')
  if (buf.length > MAX_PHOTO_BYTES) throw httpError(400, 'รูปถ่ายต้องมีขนาดไม่เกิน 1 MB')
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw httpError(400, 'ไฟล์รูปถ่ายไม่ถูกต้อง')
  return buf
}

/** every enrolled active user with the distance to this descriptor, nearest first */
export async function rankFaces(descriptor) {
  const users = await db.prepare('SELECT * FROM users WHERE active = 1 AND face_descriptor IS NOT NULL').all()
  return users
    .map((user) => ({ user, distance: euclidean(JSON.parse(user.face_descriptor), descriptor) }))
    .sort((a, b) => a.distance - b.distance)
}

export const faceThreshold = async () => Number((await getSettings()).face_threshold)

/**
 * 1:N identification. Throws a Thai error unless exactly one user clearly matches.
 * expectUserId: the match must be this user (403). record: remember an accepted scan for the replay guard
 * (set it wherever the scan grants something: check-in, face login).
 */
export async function identify(descriptor, { expectUserId, record = false } = {}) {
  readDescriptor(descriptor)
  const [best, second] = await rankFaces(descriptor)
  if (!best || !(best.distance <= (await faceThreshold()))) throw httpError(400, 'ไม่พบใบหน้าที่ลงทะเบียน')
  if (second && second.distance - best.distance < MARGIN) throw httpError(400, 'ระบุตัวตนไม่ชัดเจน กรุณาสแกนใหม่')
  if (expectUserId !== undefined && best.user.id !== expectUserId) throw httpError(403, 'ใบหน้าไม่ตรงกับบัญชีที่เข้าสู่ระบบ')

  const guard = async () => {
    const scans = await db.prepare('SELECT descriptor FROM face_scans WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(best.user.id, REPLAY_KEEP)
    if (scans.some((s) => euclidean(JSON.parse(s.descriptor), descriptor) < REPLAY_DISTANCE))
      throw httpError(400, 'ตรวจพบข้อมูลใบหน้าซ้ำ กรุณาสแกนใหม่')
    if (!record) return
    await db.prepare('INSERT INTO face_scans (user_id, descriptor) VALUES (?, ?)').run(best.user.id, JSON.stringify(descriptor))
    await db.prepare(`DELETE FROM face_scans WHERE user_id = ? AND id NOT IN
      (SELECT id FROM face_scans WHERE user_id = ? ORDER BY id DESC LIMIT ?)`).run(best.user.id, best.user.id, REPLAY_KEEP)
  }
  // check + insert in one write transaction: parallel replays cannot both pass
  await (record ? db.transaction(guard)() : guard())
  return { user: best.user, distance: round(best.distance) }
}

/** compare a live descriptor (128 floats from face-api.js) with the user's enrolled one */
export async function verifyFace(user, descriptor) {
  if (!user.face_descriptor) return { enrolled: false, match: false, distance: null }
  if (!isDescriptor(descriptor)) return { enrolled: true, match: false, distance: null }
  const distance = euclidean(JSON.parse(user.face_descriptor), descriptor)
  return { enrolled: true, match: distance <= (await faceThreshold()), distance: round(distance) }
}
