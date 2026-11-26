import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const file = process.env.DB_FILE || './data/timemint.db'
fs.mkdirSync(path.dirname(file), { recursive: true })

export const db = new Database(file)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_code TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('M','F')),
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','admin','executive')),
  department TEXT, position TEXT, phone TEXT, address TEXT,
  birthdate TEXT, start_date TEXT,
  salary REAL NOT NULL DEFAULT 0,
  avatar_url TEXT,
  face_descriptor TEXT,            -- JSON array of 128 floats, null = not enrolled
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,                       -- YYYY-MM-DD
  mode TEXT NOT NULL CHECK (mode IN ('office','building','wfh')),
  check_in_at TEXT NOT NULL,                -- YYYY-MM-DD HH:mm:ss local
  check_out_at TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','pending','rejected')),
  late_minutes INTEGER NOT NULL DEFAULT 0,
  face_verified INTEGER NOT NULL DEFAULT 0,
  face_distance REAL,
  note TEXT, reject_reason TEXT,
  reviewed_by INTEGER REFERENCES users(id), reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (user_id, date)
);
CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  days REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reject_reason TEXT,
  reviewed_by INTEGER REFERENCES users(id), reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS ot_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
  hours REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason TEXT,
  amount REAL NOT NULL DEFAULT 0,          -- set on approve (lib/payroll.js otAmount)
  reviewed_by INTEGER REFERENCES users(id), reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  year INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'news' CHECK (type IN ('news','event')),
  event_date TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  author_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  level TEXT NOT NULL CHECK (level IN ('verbal','written','final')),
  category TEXT NOT NULL,
  reason TEXT NOT NULL,
  issued_by INTEGER REFERENCES users(id),
  issued_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  cancel_reason TEXT, cancelled_by INTEGER REFERENCES users(id), cancelled_at TEXT
);
`)
