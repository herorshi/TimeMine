import { Router } from 'express'
import { db } from '../db/index.js'
import { auth } from '../lib/auth.js'
import { httpError } from '../lib/http.js'
import { isDescriptor, verifyFace } from '../lib/face.js'

const router = Router()
router.use(auth)

const readDescriptor = (req) => {
  const d = req.body?.descriptor
  if (!isDescriptor(d) || !d.every(Number.isFinite)) throw httpError(400, 'ข้อมูลใบหน้าไม่ถูกต้อง กรุณาสแกนใหม่')
  return d
}
const setDescriptor = (userId, value) => db.prepare('UPDATE users SET face_descriptor = ? WHERE id = ?').run(value, userId)

router.get('/status', (req, res) => {
  res.json({ enrolled: !!req.user.face_descriptor })
})

router.post('/enroll', async (req, res) => {
  await setDescriptor(req.user.id, JSON.stringify(readDescriptor(req)))
  res.json({ enrolled: true })
})

router.delete('/enroll', async (req, res) => {
  await setDescriptor(req.user.id, null)
  res.json({ enrolled: false })
})

router.post('/verify', async (req, res) => {
  const { enrolled, match, distance } = await verifyFace(req.user, readDescriptor(req))
  if (!enrolled) throw httpError(400, 'ยังไม่ได้ลงทะเบียนใบหน้า')
  res.json({ match, distance })
})

export default router
