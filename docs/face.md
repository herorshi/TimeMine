# Face: enroll once (evidence), identify afterwards

1. **Enroll** (first scan, logged in): the client captures 3 frames → averages the 128-d descriptors and sends one JPEG snapshot. Server stores `users.face_descriptor` (JSON), `users.face_photo_url` (lib/storage.js `saveImage`, Blob on Vercel), `users.face_enrolled_at`. Re-enroll only after an admin resets it (or the user deletes their own enrollment).
2. **Identify** (every later scan): server compares the descriptor with **every** enrolled active user (1:N). Match = best distance ≤ `face_threshold` **and** (second best − best) ≥ 0.06 (ambiguity guard). Otherwise "ไม่พบใบหน้าที่ลงทะเบียน" / "ระบุตัวตนไม่ชัดเจน กรุณาสแกนใหม่".
3. **Liveness (basic)**: the client requires movement between frames (face box centre moves ≥ 4% of width or eye-aspect-ratio blink) before it sends; the server also rejects a descriptor identical (distance < 0.02) to the last 5 accepted scans of that user (replayed capture).

## API
- `POST /api/face/enroll` (auth) `{ descriptors: number[128][] (1–5), photo: dataUrl }` → `{ enrolled: true, photo_url, enrolled_at }`; 409 if already enrolled.
- `DELETE /api/face/enroll` (auth, own) and `DELETE /api/face/enroll/:userId` (admin, employees.manage) → reset.
- `GET /api/face/status` (auth) → `{ enrolled, photo_url, enrolled_at }`.
- `POST /api/face/identify` (auth) `{ descriptor, photo }` → `{ match: true, user: {id,name,emp_code}, distance }` or 400 Thai error. Used by building check-in: must identify the **logged-in** user, else 403 "ใบหน้าไม่ตรงกับบัญชีที่เข้าสู่ระบบ".
- `POST /api/auth/face-login` (public, rate-limited like /auth/login: 10 / 15 min per IP) `{ descriptor, photo }` → identify → same response as `/auth/login` `{ token, user }`; lockout/inactive users refused. (Route lives in `backend/src/routes/face.js` mounted as an extra router on `/api/auth/face-login` by the backend issue — PM adds the mount line.)
- `POST /api/attendance/check-in` with `mode: 'building'` now takes `{ descriptor, photo }`: server identifies (must equal req.user), saves the photo to `attendance.face_photo_url`, stores `face_distance`, `face_verified = 1`.
- Admin: `GET /api/attendance` rows include `face_photo_url`; `GET /api/users` rows include `face_photo_url`, `face_enrolled_at`.
