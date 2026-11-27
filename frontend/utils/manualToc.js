// Table of contents for the user manual (/manual). One topic = one page: pages/manual/<slug>.vue.
// route: null = no app page (the 'เปิดหน้านี้ในระบบ' button is hidden). Screenshots: public/manual/<slug>-<n>.png (n from 1). Visibility mirrors the main menu (layouts/default.vue):
// group.roles = who sees the group (executive sees everything), topic.perm = permission the app page needs.
export const MANUAL_GROUPS = [
  { key: 'employee', title: 'สำหรับพนักงาน', topics: [
    { slug: 'getting-started', title: 'เริ่มต้นใช้งาน & เข้าสู่ระบบ', icon: '🚀', route: '/login' },
    { slug: 'home', title: 'หน้าหลัก', icon: '🏠', route: '/' },
    { slug: 'checkin', title: 'ลงเวลาเข้า-ออกงาน', icon: '⏰', route: '/checkin' },
    { slug: 'leave', title: 'ลางาน', icon: '🌴', route: '/leave', perm: 'leave.request' },
    { slug: 'ot', title: 'ขอทำ OT', icon: '🌙', route: '/ot', perm: 'ot.request' },
    { slug: 'holidays', title: 'ปฏิทินวันหยุด', icon: '📅', route: '/holidays' },
    { slug: 'announcements', title: 'ประกาศ & กิจกรรม', icon: '📢', route: '/announcements' },
    { slug: 'kpi', title: 'KPI ของฉัน', icon: '🎯', route: '/kpi' },
    { slug: 'warnings', title: 'ใบเตือนของฉัน', icon: '⚠️', route: '/warnings' },
    { slug: 'profile', title: 'ข้อมูลส่วนตัว & เปลี่ยนรหัสผ่าน', icon: '👤', route: '/profile' },
  ] },
  { key: 'admin', title: 'สำหรับ Admin', roles: ['admin'], topics: [
    { slug: 'admin-attendance', title: 'การเข้างาน / อนุมัติ WFH', icon: '🗂️', route: '/admin/attendance', perm: 'approve.attendance' },
    { slug: 'admin-line', title: 'แจ้งเตือนผ่าน LINE', icon: '💬', route: null, perm: 'approve.attendance' },
    { slug: 'admin-leaves', title: 'อนุมัติการลา', icon: '✅', route: '/admin/leaves', perm: 'approve.leaves' },
    { slug: 'admin-ot', title: 'อนุมัติ OT', icon: '💰', route: '/admin/ot', perm: 'approve.ot' },
    { slug: 'admin-warnings', title: 'ออกใบเตือน', icon: '📝', route: '/admin/warnings', perm: 'warnings.manage' },
    { slug: 'admin-announcements', title: 'จัดการประกาศ', icon: '📣', route: '/admin/announcements', perm: 'announcements.manage' },
    { slug: 'admin-faces', title: 'ลงทะเบียนใบหน้า', icon: '📸', route: '/admin/faces', perm: 'employees.manage' },
    { slug: 'admin-employees', title: 'จัดการพนักงาน', icon: '👥', route: '/admin/employees', perm: 'employees.manage' },
    { slug: 'admin-holidays', title: 'จัดการวันหยุด', icon: '🗓️', route: '/admin/holidays', perm: 'holidays.manage' },
    { slug: 'admin-kpi', title: 'ประเมิน KPI', icon: '🏅', route: '/admin/kpi', perm: 'kpi.manage' },
    { slug: 'admin-reports', title: 'รายงาน', icon: '📊', route: '/admin/reports', perm: 'reports.view' },
    { slug: 'admin-settings', title: 'ตั้งค่าระบบ & พิกัดตึก', icon: '⚙️', route: '/admin/settings', perm: 'settings.manage' },
  ] },
  { key: 'executive', title: 'สำหรับผู้บริหาร', roles: ['executive'], topics: [
    { slug: 'exec-overview', title: 'ภาพรวม & สถิติ', icon: '📈', route: '/executive' },
    { slug: 'exec-kpi', title: 'KPI Dashboard', icon: '🏆', route: '/executive/kpi' },
    { slug: 'exec-admins', title: 'จัดการ Admin', icon: '🛡️', route: '/executive/admins' },
    { slug: 'exec-permissions', title: 'สิทธิ์การใช้งาน', icon: '🔐', route: '/executive/permissions' },
  ] },
]

export const ALL_TOPICS = MANUAL_GROUPS.flatMap((g) => g.topics.map((t) => ({ ...t, group: g.key })))
export const findTopic = (slug) => ALL_TOPICS.find((t) => t.slug === slug)

/** groups + topics the signed-in user may read (same rule as the main sidebar) */
export function visibleManual(auth) {
  return MANUAL_GROUPS
    .filter((g) => !g.roles || g.roles.includes(auth.role) || auth.isExecutive)
    .map((g) => ({ ...g, topics: g.topics.filter((t) => !t.perm || auth.can(t.perm)) }))
    .filter((g) => g.topics.length)
}
export const canRead = (auth, slug) => visibleManual(auth).some((g) => g.topics.some((t) => t.slug === slug))
