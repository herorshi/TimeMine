import { Router } from 'express'
import { db } from '../db/index.js'
import { auth, requireRole } from '../lib/auth.js'
import { httpError } from '../lib/http.js'

// TODO(ot): implemented by its ARP issue — see docs/api.md
const router = Router()
router.use(auth)
export default router
