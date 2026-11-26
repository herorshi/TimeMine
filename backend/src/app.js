import './tz.js'
import express from 'express'
import { db } from './db/index.js'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'
import attendanceRouter from './routes/attendance.js'
import faceRouter from './routes/face.js'
import leavesRouter from './routes/leaves.js'
import otRouter from './routes/ot.js'
import holidaysRouter from './routes/holidays.js'
import announcementsRouter from './routes/announcements.js'
import usersRouter from './routes/users.js'
import settingsRouter from './routes/settings.js'
import warningsRouter from './routes/warnings.js'
import reportsRouter from './routes/reports.js'
import statsRouter from './routes/stats.js'
import dashboardRouter from './routes/dashboard.js'
import passwordRouter from './routes/password.js'
import permissionsRouter from './routes/permissions.js'
import { permissionGate } from './lib/permissions.js'
import { apiLimiter, passwordLimiter, isProduction } from './lib/security.js'

export const app = express()

app.set('trust proxy', 1) // one proxy in front (Vercel): req.ip is the client
app.disable('x-powered-by')

// allow-list only; production never falls back to (or accepts) '*'
const corsList = (process.env.CORS_ORIGIN || (isProduction ? '' : 'http://localhost:3000'))
  .split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
const corsOrigin = !isProduction && corsList.includes('*') ? '*' : corsList.filter((o) => o !== '*')

app.use(helmet())
app.use(cors({ origin: corsOrigin }))
app.use('/api', apiLimiter)
app.use(express.json({ limit: '2mb' }))
// never log tokens carried in a query string (password reset link check)
morgan.token('url', (req) => (req.originalUrl || req.url).replace(/([?&]token=)[^&]*/gi, '$1[redacted]'))
app.use(morgan('dev'))
app.use(async (_req, _res, next) => { await db.ready(); next() }) // schema applied before any query

app.use('/api/health', healthRouter)
app.use('/api/password', passwordLimiter, passwordRouter) // public: forgot / reset password
app.use('/api', permissionGate) // per-role / per-user permissions (lib/permissions.js)
app.use('/api/auth', authRouter)
app.use('/api/attendance', attendanceRouter)
app.use('/api/face', faceRouter)
app.use('/api/leaves', leavesRouter)
app.use('/api/ot', otRouter)
app.use('/api/holidays', holidaysRouter)
app.use('/api/announcements', announcementsRouter)
app.use('/api/users', usersRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/warnings', warningsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/stats', statsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/permissions', permissionsRouter)

app.use((_req, res) => res.status(404).json({ error: 'not found' }))
app.use((err, _req, res, _next) => {
  // body-parser errors carry parser details in err.message: send a generic text instead
  if (err.type && err.status < 500)
    return res.status(err.status).json({ error: err.status === 413 ? 'ข้อมูลมีขนาดใหญ่เกินไป' : 'รูปแบบข้อมูลไม่ถูกต้อง' })
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message })
  console.error(err)
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })
})

export default app // Vercel: Express app as the function entry
