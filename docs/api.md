# TimeMint API contract

Base `/api`. Auth: `Authorization: Bearer <token>` (all routes except `/auth/login`, `/health`). Errors: `{ error: 'ข้อความ' }`.
Roles: employee < admin < executive (executive passes every admin check). Every admin/executive is also an employee.

| Area | Owner issue | Endpoints |
|---|---|---|
| auth (done) | foundation | POST /auth/login {email,password}→{token,user}; GET /auth/me; POST /auth/change-password {current,next} |
| attendance | Attendance | POST /attendance/check-in {mode:'office'\|'building'\|'wfh', descriptor?:number[128], note?}; POST /attendance/check-out; GET /attendance/today; GET /attendance/me?from&to; GET /attendance/me/late-summary?month=YYYY-MM → {count, minutes, month_count, month_minutes}; admin: GET /attendance?date&status&mode, POST /attendance/:id/approve, POST /attendance/:id/reject {reason} |
| face | Face scan | GET /face/status → {enrolled}; POST /face/enroll {descriptor}; DELETE /face/enroll; POST /face/verify {descriptor} → {match,distance}. Matching: `verifyFace(user, descriptor)` in backend/src/lib/face.js (done) |
| leaves | Leave | GET /leaves/types (gender-filtered); GET /leaves/me; GET /leaves/me/balance?year → [{type,label,quota,used}]; POST /leaves {type,start_date,end_date,reason}; POST /leaves/:id/cancel; admin: GET /leaves?status, POST /leaves/:id/approve, POST /leaves/:id/reject {reason} |
| ot | OT | GET /ot/me; GET /ot/me/summary?month → {hours, amount, pending}; POST /ot {date,start_time,end_time,reason}; POST /ot/:id/cancel; admin: GET /ot?status, POST /ot/:id/approve (amount = lib/payroll otAmount), POST /ot/:id/reject {reason} |
| holidays | Holidays+Announcements | GET /holidays?year; GET /holidays/years; admin: POST /holidays, PUT /holidays/:id, DELETE /holidays/:id |
| announcements | Holidays+Announcements | GET /announcements?type; admin: POST, PUT /:id, DELETE /:id |
| users | Profile+Employees+Settings | GET/PUT /users/me (name, phone, address, birthdate, avatar_url); admin: GET /users, POST /users, PUT /users/:id, POST /users/:id/reset-password, DELETE (deactivate) /users/:id |
| settings | Profile+Employees+Settings | GET /settings (any user); admin: PUT /settings |
| warnings | Warnings+Reports | GET /warnings/me; admin: GET /warnings?user_id&status, POST /warnings {user_id,level,category,reason}, POST /warnings/:id/cancel {reason} |
| reports | Warnings+Reports | admin: GET /reports/attendance?from&to&user_id, GET /reports/leaves?from&to, GET /reports/ot?from&to, GET /reports/payroll?month — each supports `format=csv` |
| stats | Executive | executive: GET /stats/overview?year → monthly series: check-ins, late count/minutes, wfh, warnings, working days, payroll per month, year totals; by department |
| dashboard | Employee home | GET /dashboard/me → today status, late summary, leave balances, OT this month, latest announcements, active warnings count; admin also gets pending counts |

Shared backend helpers (done, do not edit): `lib/auth.js` (auth, requireRole, publicUser, isAdmin), `lib/time.js` (toDateStr, toDateTimeStr, lateMinutes, workingDaysBetween), `lib/settings.js` (getSettings), `lib/payroll.js` (rates, otAmount, monthlyPay), `lib/face.js` (verifyFace), `lib/constants.js` (LEAVE_TYPES, leaveTypesFor, WARNING_*), `lib/http.js` (httpError).
