// All times are server-local (Asia/Bangkok in deployment). Formats: date 'YYYY-MM-DD', datetime 'YYYY-MM-DD HH:mm:ss'.
const pad = (n) => String(n).padStart(2, '0')
export const toDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toDateTimeStr = (d = new Date()) => `${toDateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
export const hhmmToMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0) }

/** minutes late for a check-in datetime string, given settings (work_start + late_grace_min). 0 when on time. */
export function lateMinutes(checkInAt, settings) {
  const t = checkInAt.slice(11, 16)
  const diff = hhmmToMin(t) - hhmmToMin(settings.work_start)
  return diff > Number(settings.late_grace_min || 0) ? diff : 0
}

/** inclusive day count between two YYYY-MM-DD dates, skipping Sat/Sun */
export function workingDaysBetween(start, end) {
  let n = 0
  for (let d = new Date(start + 'T00:00:00'); d <= new Date(end + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
    const w = d.getDay(); if (w !== 0 && w !== 6) n++
  }
  return n
}
