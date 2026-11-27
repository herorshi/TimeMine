import { db } from '../db/index.js'

export const DEFAULT_SETTINGS = {
  company_name: 'TimeMint Co., Ltd.',
  work_start: '09:00',        // HH:mm — check-in after this (+grace) is late
  work_end: '18:00',
  late_grace_min: '5',
  late_yellow_min: '1',      // late ≥ this many minutes → yellow
  late_red_min: '30',        // late ≥ this many minutes → red
  work_days_per_month: '22',
  work_hours_per_day: '8',
  ot_multiplier: '1.5',
  face_threshold: '0.5',      // euclidean distance; lower = stricter
  office_lat: '',             // building latitude for check-in geofence ('' = geofence off)
  office_lng: '',             // building longitude ('' = geofence off)
  office_radius_m: '200',     // allowed distance from the building, metres
}

export async function getSettings() {
  const rows = await db.prepare('SELECT key, value FROM settings').all()
  const s = { ...DEFAULT_SETTINGS }
  for (const r of rows) s[r.key] = r.value
  return s
}
export async function setSettings(patch) {
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  await db.transaction(async () => { for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_SETTINGS) await up.run(k, String(v)) })()
  return getSettings()
}
