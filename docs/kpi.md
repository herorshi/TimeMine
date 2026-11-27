# KPI — annual evaluation

Table `kpi_evaluations` (backend/src/db/index.js): one row per (user_id, year).

## Scoring (0–100)
- **attendance_score** (auto, weight 20%): start 100 for the year; −1 per late check-in, −0.05 per late minute (cap −30 total for minutes), −5 per absent working day (working day with no attendance, no approved leave, not a holiday, from max(start_date, Jan 1) to min(today, Dec 31)), −10 per active warning in that year (cancelled ones don't count); clamp 0..100; round 1 decimal.
- **quality, productivity, teamwork, responsibility** (manual, 1–5 each, weight 20% each): score = value × 20.
- **total_score** = 0.2·attendance + 0.2·(quality·20) + 0.2·(productivity·20) + 0.2·(teamwork·20) + 0.2·(responsibility·20), 1 decimal. Missing manual values → total uses only attendance part (draft).
- **grade**: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, else F.

## API (`/api/kpi`, auth)
- `GET /kpi/me?year=` → own evaluation `{ year, evaluation|null, attendance: {score, late_count, late_minutes, absent_days, warnings} }` (only `final` evaluations show manual scores + comment; drafts show `null`).
- `GET /kpi/candidates?year=` (kpi.manage) → every active non-executive user with `{ user:{id,name,emp_code,department,position,role}, attendance:{...computed now}, evaluation|null }`.
- `PUT /kpi/evaluations/:userId?year=` (kpi.manage) body `{ quality, productivity, teamwork, responsibility, comment, status: 'draft'|'final' }` → recomputes attendance_score, total, grade; upsert; returns the row. An admin cannot evaluate themself (403). Final can be re-opened only by an executive.
- `GET /kpi/ranking?year=` (executive only) → `{ year, years:[...], rows:[{ rank, user, total_score, grade, attendance_score, quality, productivity, teamwork, responsibility, status }], by_department:[{department, avg, count}], grade_counts:{A,B,C,D,F}, average }` sorted by total_score desc (ties: attendance_score desc, name).
- `GET /kpi/years` → years that have evaluations or attendance (desc).
