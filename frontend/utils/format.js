import dayjs from 'dayjs'
import 'dayjs/locale/th'
dayjs.locale('th')

export const fmtDate = (d) => (d ? dayjs(d).format('D MMM YYYY') : '-')
export const fmtDateTime = (d) => (d ? dayjs(d).format('D MMM YYYY HH:mm') : '-')
export const fmtTime = (d) => (d ? dayjs(d).format('HH:mm') : '-')
export const fmtMoney = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
export const fmtNumber = (n) => Number(n || 0).toLocaleString('th-TH')
export const fmtMinutes = (m) => { m = Number(m || 0); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที` }
export const todayStr = () => dayjs().format('YYYY-MM-DD')
export const apiError = (e) => e?.response?.data?.error || e?.message || 'เกิดข้อผิดพลาด'
export { dayjs }
