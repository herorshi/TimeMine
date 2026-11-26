# Async DB conversion (better-sqlite3 → libSQL/Turso)

`backend/src/db/index.js` now talks to libSQL (Turso on Vercel, a local file in dev). Same API, but **every call is async**:

| before | after |
|---|---|
| `db.prepare(sql).get(a, b)` | `await db.prepare(sql).get(a, b)` |
| `db.prepare(sql).all(...)` / `.run(...)` | `await ...all(...)` / `await ...run(...)` (`run` → `{ changes, lastInsertRowid }`) |
| `const stmt = db.prepare(sql); stmt.run(x)` in a loop | fine — `await stmt.run(x)` each time |
| `db.transaction(() => { ... })()` | `await db.transaction(async () => { ... await ... })()` — calls inside automatically use the transaction |
| `db.exec(sql)` at module load | keep it (queued before `db.ready()`), or move the table to `db/index.js` |

Lib functions that are now async (await them): `getSettings`, `setSettings`, `rates`, `otAmount`, `monthlyPay`, `verifyFace`, `publicUser`, `effectivePermissions`, `roleDefaults`, `overridesFor`, `can`. Sync and unchanged: `lateMinutes`, `toDateStr`, `toDateTimeStr`, `workingDaysBetween`, `hhmmToMin`, `isDescriptor`, `euclidean`, `signToken`, `requireRole`, `isAdmin`, `leaveTypesFor`, `keysForRole`.

Rules: make every handler `async`; never call `.map(r => db...)` without `await Promise.all(...)` (or use a for-loop); `Array.prototype.filter/sort` callbacks must not call the DB; keep SQL as is (SQLite dialect works on Turso). Express 5 forwards rejected promises to the error handler.

Check: `cd backend && node --check <file>` and `node -e "import('./src/app.js')"`. Then boot once on a scratch DB and hit your endpoints:
`DB_FILE=/tmp/tm-<issue>.db PORT=<4100+issue> node src/db/seed.js && DB_FILE=/tmp/tm-<issue>.db PORT=<4100+issue> node src/server.js` (seed only if your file is not seed.js; if the seed is not converted yet, just boot and test reads that need no data). Login: `POST /api/auth/login {"email":"admin@timemint.local","password":"admin123"}`.
