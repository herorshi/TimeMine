import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { rateLimit } from 'express-rate-limit'
import { db } from '../db/index.js'
import { auth, requireRole, signToken, publicUser } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { readDescriptor, readPhoto, rankFaces, faceThreshold, identify, verifyFace } from '../lib/face.js'
import { can } from '../lib/permissions.js'
import { takeAttempt, clearAttempts } from '../lib/security.js'
import { saveImage, deleteImage } from '../lib/storage.js'
import { toDateTimeStr } from '../lib/time.js'

const router = Router()
router.use(auth)

const requireManage = async (req, _res, next) => {
  if (!(await can(req.user, 'employees.manage'))) throw httpError(403, 'คุณไม่ได้รับสิทธิ์ใช้งานส่วนนี้ กรุณาติดต่อผู้บริหาร')
  next()
}

/** same rule as routes/users.js: only an executive may manage admin/executive accounts (a face is a login) */
async function target(req) {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId)
  if (!user) throw httpError(404, 'ไม่พบพนักงาน')
  if (user.role !== 'employee' && req.user.role !== 'executive') throw httpError(403, 'เฉพาะผู้บริหารเท่านั้น')
  return user
}

const alreadyEnrolled = () => httpError(409, 'พนักงานคนนี้ลงทะเบียนใบหน้าแล้ว กรุณารีเซ็ตก่อน')

async function assertFaceFree(descriptor, userId) {
  const threshold = await faceThreshold()
  const other = (await rankFaces(descriptor)).find((r) => r.user.id !== userId && r.distance <= threshold)
  if (other) throw httpError(409, `ใบหน้านี้ลงทะเบียนกับ ${other.user.name} แล้ว`)
}

router.post('/enroll/:userId', requireRole('admin'), requireManage, async (req, res) => {
  const user = await target(req)
  const list = req.body?.descriptors
  if (!Array.isArray(list) || list.length < 1 || list.length > 5) throw httpError(400, 'ข้อมูลใบหน้าไม่ถูกต้อง กรุณาสแกนใหม่')
  list.forEach(readDescriptor)
  const photo = readPhoto(req.body?.photo)
  if (user.face_descriptor) throw alreadyEnrolled()
  const descriptor = list[0].map((_, i) => list.reduce((s, d) => s + d[i], 0) / list.length)
  await assertFaceFree(descriptor, user.id)

  // random suffix: blob URLs are public, so the name must not be guessable
  const photoUrl = await saveImage(photo, 'image/jpeg', `faces/${user.id}-${req.user.id}-${Date.now()}-${randomUUID()}`)
  const enrolledAt = toDateTimeStr()
  try {
    // re-checked inside the write transaction: a concurrent enrollment cannot slip in between
    await db.transaction(async () => {
      await assertFaceFree(descriptor, user.id)
      const info = await db.prepare('UPDATE users SET face_descriptor = ?, face_photo_url = ?, face_enrolled_at = ? WHERE id = ? AND face_descriptor IS NULL')
        .run(JSON.stringify(descriptor), photoUrl, enrolledAt, user.id)
      if (!info.changes) throw alreadyEnrolled()
    })()
  } catch (e) {
    await deleteImage(photoUrl)
    throw e
  }
  res.json({ enrolled: true, photo_url: photoUrl, enrolled_at: enrolledAt })
})

router.delete('/enroll/:userId', requireRole('admin'), requireManage, async (req, res) => {
  const user = await target(req)
  await db.prepare('UPDATE users SET face_descriptor = NULL, face_photo_url = NULL, face_enrolled_at = NULL WHERE id = ?').run(user.id)
  await db.prepare('DELETE FROM face_scans WHERE user_id = ?').run(user.id)
  await deleteImage(user.face_photo_url)
  res.json({ enrolled: false })
})

// self-enroll is gone: only an admin enrolls (docs/face.md)
const noSelfEnroll = () => { throw httpError(403, 'การลงทะเบียนใบหน้าต้องทำโดยผู้ดูแลระบบเท่านั้น') }
router.route('/enroll').post(noSelfEnroll).delete(noSelfEnroll)

router.get('/status', (req, res) => {
  const u = req.user
  res.json({ enrolled: !!u.face_descriptor, photo_url: u.face_photo_url || null, enrolled_at: u.face_enrolled_at || null })
})

router.post('/identify', async (req, res) => {
  const descriptor = readDescriptor(req.body?.descriptor)
  readPhoto(req.body?.photo)
  const { user, distance } = await identify(descriptor)
  res.json({ match: true, user: { id: user.id, name: user.name, emp_code: user.emp_code }, distance })
})

router.post('/verify', async (req, res) => {
  const { enrolled, match, distance } = await verifyFace(req.user, readDescriptor(req.body?.descriptor))
  if (!enrolled) throw httpError(400, 'ยังไม่ได้ลงทะเบียนใบหน้า')
  res.json({ match, distance })
})

export default router

// public face login (docs/face.md), mounted on /api/auth/face-login
export const faceLoginRouter = Router()
const faceLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ใน 15 นาที' },
})

faceLoginRouter.post('/', faceLoginLimiter, async (req, res) => {
  const descriptor = readDescriptor(req.body?.descriptor)
  readPhoto(req.body?.photo)
  const { user } = await identify(descriptor, { record: true }) // active users only
  const email = String(user.email).trim().toLowerCase()
  takeAttempt(email) // throws while the account is locked
  clearAttempts(email)
  res.json({ token: signToken(user), user: await publicUser(user) })
})
