// Mirrors backend/src/lib/constants.js
export const LEAVE_TYPES = {
  sick: { label: 'ลาป่วย', gender: null, quota: 30, icon: '🤒' },
  personal: { label: 'ลากิจ', gender: null, quota: 6, icon: '📋' },
  vacation: { label: 'ลาพักร้อน', gender: null, quota: 10, icon: '🏖️' },
  unpaid: { label: 'ลาไม่รับเงินเดือน', gender: null, quota: null, icon: '💸' },
  ordination: { label: 'ลาบวช', gender: 'M', quota: 15, icon: '🙏' },
  military: { label: 'ลาเกณฑ์ทหาร', gender: 'M', quota: 60, icon: '🎖️' },
  maternity: { label: 'ลาคลอด', gender: 'F', quota: 98, icon: '👶' },
  menstrual: { label: 'ลาปวดประจำเดือน', gender: 'F', quota: 12, icon: '🌸' },
}
export const leaveTypesFor = (gender) =>
  Object.entries(LEAVE_TYPES).filter(([, t]) => !t.gender || t.gender === gender).map(([key, t]) => ({ key, ...t }))

export const CHECKIN_MODES = {
  office: { label: 'เข้างานที่ Office', icon: '🏢' },
  building: { label: 'เข้างานที่ตึก (สแกนหน้า)', icon: '🏬' },
  wfh: { label: 'Work from Home', icon: '🏠' },
}
export const STATUS = {
  pending: { label: 'รออนุมัติ', color: 'amber' },
  approved: { label: 'อนุมัติแล้ว', color: 'emerald' },
  rejected: { label: 'ไม่อนุมัติ', color: 'rose' },
  cancelled: { label: 'ยกเลิก', color: 'slate' },
  active: { label: 'มีผล', color: 'rose' },
}
export const WARNING_LEVELS = { verbal: 'ตักเตือนด้วยวาจา', written: 'ใบเตือนเป็นลายลักษณ์อักษร', final: 'ใบเตือนครั้งสุดท้าย' }
export const WARNING_CATEGORIES = { late: 'มาสาย', absent: 'ขาดงาน', conduct: 'ความประพฤติ', performance: 'ผลงาน', other: 'อื่นๆ' }
export const ROLE_LABELS = { employee: 'พนักงาน', admin: 'Admin', executive: 'ผู้บริหาร' }
