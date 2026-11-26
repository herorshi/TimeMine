# TimeMine — Backend

Node.js + Express 5 + SQLite (better-sqlite3).

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:4000
```

| Method | Path             | Description   |
|--------|------------------|---------------|
| GET    | /api/health      | health check  |
| GET    | /api/tasks       | list tasks    |
| POST   | /api/tasks       | create `{ title }` |
| PATCH  | /api/tasks/:id   | update `{ title?, done? }` |
| DELETE | /api/tasks/:id   | delete        |
