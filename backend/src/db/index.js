// Database: libSQL (Turso in production, a local SQLite file in dev).
// API mirrors better-sqlite3 but is async:  await db.prepare(sql).get(...args) / .all(...) / .run(...)
//   await db.exec(multiStatementSql)        (module-level calls are queued into db.ready())
//   await db.transaction(async () => { await db.prepare(...).run(...) })()   — statements inside run on the tx
// Env: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (Vercel Marketplace Turso) or DB_FILE for local dev.
import { createClient } from '@libsql/client'
import { AsyncLocalStorage } from 'node:async_hooks'
import fs from 'node:fs'
import path from 'node:path'

const remoteUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL
let url = remoteUrl
if (!url) {
  const file = process.env.DB_FILE || './data/timemint.db'
  fs.mkdirSync(path.dirname(file), { recursive: true })
  url = 'file:' + file
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN })
const txStore = new AsyncLocalStorage()
const exec = () => txStore.getStore() || client

const toArgs = (args) => (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0]) ? args[0] : args.flat())
const toObj = (rs, row) => Object.fromEntries(rs.columns.map((c, i) => [c, typeof row[i] === 'bigint' ? Number(row[i]) : row[i]]))

let chain = Promise.resolve()
const queue = (fn) => (chain = chain.then(fn))

export const db = {
  prepare(sql) {
    return {
      async get(...args) { const rs = await exec().execute({ sql, args: toArgs(args) }); return rs.rows[0] ? toObj(rs, rs.rows[0]) : undefined },
      async all(...args) { const rs = await exec().execute({ sql, args: toArgs(args) }); return rs.rows.map((r) => toObj(rs, r)) },
      async run(...args) {
        const rs = await exec().execute({ sql, args: toArgs(args) })
        return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid === undefined ? undefined : Number(rs.lastInsertRowid) }
      },
    }
  },
  /** multi-statement SQL; safe to call at module load (queued before db.ready() resolves) */
  exec(sql) { return queue(() => client.executeMultiple(sql)) },
  /** returns an async function; every db call inside fn runs on one write transaction */
  transaction(fn) {
    return async (...args) => {
      if (txStore.getStore()) return fn(...args) // nested: reuse the outer tx
      const tx = await client.transaction('write')
      try {
        const out = await txStore.run(tx, () => fn(...args))
        await tx.commit()
        return out
      } catch (e) {
        await tx.rollback().catch(() => {})
        throw e
      } finally { tx.close() }
    }
  },
  /** resolves once the schema (and any module-level exec) has been applied */
  ready() { return chain },
  client,
}

queue(() => client.execute('PRAGMA foreign_keys = ON').catch(() => {}))
// additive migrations for databases created before a column existed (errors = column already there)
const addColumn = (table, col) => queue(() => client.execute(`ALTER TABLE ${table} ADD COLUMN ${col}`).catch(() => {}))
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
  image_url TEXT,
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

CREATE TABLE IF NOT EXISTS kpi_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  attendance_score REAL NOT NULL DEFAULT 0,   -- 0-100, computed from attendance/late/absence/warnings
  quality INTEGER, productivity INTEGER, teamwork INTEGER, responsibility INTEGER, -- 1-5 each
  total_score REAL NOT NULL DEFAULT 0,        -- 0-100 weighted
  grade TEXT,                                 -- A/B/C/D/F
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final')),
  evaluator_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (user_id, year)
);
CREATE TABLE IF NOT EXISTS role_permissions (role TEXT NOT NULL, perm TEXT NOT NULL, allowed INTEGER NOT NULL, PRIMARY KEY (role, perm));
CREATE TABLE IF NOT EXISTS user_permissions (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, perm TEXT NOT NULL, allowed INTEGER NOT NULL, PRIMARY KEY (user_id, perm));
`)
addColumn('announcements', 'image_url TEXT') // announcement image (Vercel Blob URL, or a data URL in local dev)
addColumn('users', 'face_photo_url TEXT') // enrollment evidence photo
addColumn('users', 'face_enrolled_at TEXT')
addColumn('attendance', 'face_photo_url TEXT') // check-in evidence photo (building mode)
addColumn('attendance', 'check_in_lat REAL') // geofence: location sent at check-in
addColumn('attendance', 'check_in_lng REAL')
addColumn('attendance', 'check_in_accuracy REAL')
addColumn('attendance', 'location_distance REAL') // metres from the building (null = not computed)
