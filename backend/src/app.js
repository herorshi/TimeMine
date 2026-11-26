import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import healthRouter from './routes/health.js'
import tasksRouter from './routes/tasks.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }))
app.use(express.json())
app.use(morgan('dev'))

app.use('/api/health', healthRouter)
app.use('/api/tasks', tasksRouter)

app.use((_req, res) => res.status(404).json({ error: 'not found' }))
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal server error' })
})
