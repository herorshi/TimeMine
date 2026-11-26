import { db } from '../db/index.js'

export const DEFAULT_SETTINGS = {
  company_name: 'TimeMint Co., Ltd.',
  work_start: '09:00',        // HH:mm — check-in after this (+grace) is late
  work_end: '18:00',
  late_grace_min: '5',
  work_days_per_month: '22',
  work_hours_per_day: '8',
  ot_multiplier: '1.5',
  face_threshold: '0.5',      // euclidean distance; lower = stricter
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const s = { ...DEFAULT_SETTINGS }
  for (const r of rows) s[r.key] = r.value
  return s
}
export function setSettings(patch) {
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  db.transaction(() => { for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_SETTINGS) up.run(k, String(v)) })()
  return getSettings()
}
