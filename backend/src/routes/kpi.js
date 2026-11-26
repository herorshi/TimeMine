import { Router } from 'express'
import { auth } from '../lib/auth.js'

// TODO(kpi): implemented by its ARP issue — contract in docs/kpi.md
const router = Router()
router.use(auth)
export default router
