// Leave types. gender: null = everyone, 'M' = men only, 'F' = women only. quota: days per year (null = no cap).
export const LEAVE_TYPES = {
  sick:       { label: 'ลาป่วย',          gender: null, quota: 30 },
  personal:   { label: 'ลากิจ',           gender: null, quota: 6 },
  vacation:   { label: 'ลาพักร้อน',        gender: null, quota: 10 },
  unpaid:     { label: 'ลาไม่รับเงินเดือน', gender: null, quota: null },
  ordination: { label: 'ลาบวช',           gender: 'M',  quota: 15 },
  military:   { label: 'ลาเกณฑ์ทหาร',     gender: 'M',  quota: 60 },
  maternity:  { label: 'ลาคลอด',          gender: 'F',  quota: 98 },
  menstrual:  { label: 'ลาปวดประจำเดือน',  gender: 'F',  quota: 12 },
}
export const leaveTypesFor = (gender) =>
  Object.entries(LEAVE_TYPES).filter(([, t]) => !t.gender || t.gender === gender).map(([key, t]) => ({ key, ...t }))

export const WARNING_LEVELS = { verbal: 'ตักเตือนด้วยวาจา', written: 'ใบเตือนเป็นลายลักษณ์อักษร', final: 'ใบเตือนครั้งสุดท้าย' }
export const WARNING_CATEGORIES = { late: 'มาสาย', absent: 'ขาดงาน', conduct: 'ความประพฤติ', performance: 'ผลงาน', other: 'อื่นๆ' }
export const ROLES = ['employee', 'admin', 'executive']
