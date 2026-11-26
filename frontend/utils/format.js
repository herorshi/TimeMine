import dayjs from 'dayjs'
import 'dayjs/locale/th'
import buddhistEra from 'dayjs/plugin/buddhistEra'
dayjs.extend(buddhistEra)
dayjs.locale('th')
// All dates show the Thai Buddhist year (พ.ศ.), matching the year selectors.

export const fmtDate = (d) => (d ? dayjs(d).format('D MMM BBBB') : '-')
export const fmtDateTime = (d) => (d ? dayjs(d).format('D MMM BBBB HH:mm') : '-')
export const fmtTime = (d) => (d ? dayjs(d).format('HH:mm') : '-')
export const fmtMoney = (n) => {
  const v = Math.round(Number(n || 0) * 100) / 100
  const d = Number.isInteger(v) ? 0 : 2 // ฿25,000 or ฿3,903.40 — never ฿3,903.4
  return `฿${v.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d })}`
}
export const fmtNumber = (n) => Number(n || 0).toLocaleString('th-TH')
export const fmtMinutes = (m) => { m = Number(m || 0); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที` }
export const todayStr = () => dayjs().format('YYYY-MM-DD')
export const apiError = (e) => e?.response?.data?.error || e?.message || 'เกิดข้อผิดพลาด'
export { dayjs }
