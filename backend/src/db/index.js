import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const file = process.env.DB_FILE || './data/timemine.db'
fs.mkdirSync(path.dirname(file), { recursive: true })

export const db = new Database(file)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
