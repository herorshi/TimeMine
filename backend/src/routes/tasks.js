import { Router } from 'express'
import { db } from '../db/index.js'

const router = Router()
const toTask = (r) => ({ ...r, done: !!r.done })

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM tasks ORDER BY id DESC').all().map(toTask))
})

router.post('/', (req, res) => {
  const title = String(req.body?.title ?? '').trim()
  if (!title) return res.status(400).json({ error: 'title is required' })
  const { lastInsertRowid } = db.prepare('INSERT INTO tasks (title) VALUES (?)').run(title)
  res.status(201).json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(lastInsertRowid)))
})

router.patch('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  const title = req.body?.title !== undefined ? String(req.body.title).trim() : row.title
  const done = req.body?.done !== undefined ? (req.body.done ? 1 : 0) : row.done
  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(title, done, row.id)
  res.json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(row.id)))
})

router.delete('/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  if (!changes) return res.status(404).json({ error: 'not found' })
  res.status(204).end()
})

export default router
