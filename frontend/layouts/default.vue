<script setup>
import { ROLE_LABELS } from '~/utils/constants'
const auth = useAuthStore()
const route = useRoute()
const mobileOpen = ref(false)
watch(() => route.path, () => (mobileOpen.value = false))

// Sidebar menu. roles: who sees the item (executive sees everything).
const groups = [
  { title: 'พนักงาน', items: [
    { to: '/', label: 'หน้าหลัก', icon: '🏠' },
    { to: '/checkin', label: 'ลงเวลาเข้า-ออกงาน', icon: '⏰' },
    { to: '/leave', perm: 'leave.request', label: 'ลางาน', icon: '🌴' },
    { to: '/ot', perm: 'ot.request', label: 'ขอทำ OT', icon: '🌙' },
    { to: '/holidays', label: 'ปฏิทินวันหยุด', icon: '📅' },
    { to: '/announcements', label: 'ประกาศ & กิจกรรม', icon: '📢' },
    { to: '/kpi', label: 'KPI ของฉัน', icon: '🎯' },
    { to: '/warnings', label: 'ใบเตือนของฉัน', icon: '⚠️' },
    { to: '/profile', label: 'ข้อมูลส่วนตัว', icon: '👤' },
    { to: '/manual', label: 'คู่มือการใช้งาน', icon: '📖' },
  ] },
  { title: 'Admin', roles: ['admin'], items: [
    { to: '/admin/attendance', perm: 'approve.attendance', label: 'การเข้างาน / อนุมัติ WFH', icon: '🗂️' },
    { to: '/admin/leaves', perm: 'approve.leaves', label: 'อนุมัติการลา', icon: '✅' },
    { to: '/admin/ot', perm: 'approve.ot', label: 'อนุมัติ OT', icon: '💰' },
    { to: '/admin/warnings', perm: 'warnings.manage', label: 'ใบเตือน', icon: '📝' },
    { to: '/admin/announcements', perm: 'announcements.manage', label: 'จัดการประกาศ', icon: '📣' },
    { to: '/admin/faces', perm: 'employees.manage', label: 'ลงทะเบียนใบหน้า', icon: '🧑‍💼' },
    { to: '/admin/employees', perm: 'employees.manage', label: 'จัดการพนักงาน', icon: '👥' },
    { to: '/admin/holidays', perm: 'holidays.manage', label: 'จัดการวันหยุด', icon: '🗓️' },
    { to: '/admin/kpi', perm: 'kpi.manage', label: 'ประเมิน KPI', icon: '🏅' },
    { to: '/admin/reports', perm: 'reports.view', label: 'รายงาน', icon: '📊' },
    { to: '/admin/settings', perm: 'settings.manage', label: 'ตั้งค่าระบบ', icon: '⚙️' },
  ] },
  { title: 'ผู้บริหาร', roles: ['executive'], items: [
    { to: '/executive', label: 'ภาพรวม & สถิติ', icon: '📈' },
    { to: '/executive/kpi', label: 'KPI Dashboard', icon: '🏆' },
    { to: '/executive/admins', label: 'จัดการ Admin', icon: '🛡️' },
    { to: '/executive/permissions', label: 'สิทธิ์การใช้งาน', icon: '🔐' },
  ] },
]
const visible = computed(() => groups
  .filter((g) => !g.roles || g.roles.includes(auth.role) || auth.isExecutive)
  .map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || auth.can(i.perm)) }))
  .filter((g) => g.items.length))
const isActive = (to) => (to === '/' || to === '/executive' ? route.path === to : route.path.startsWith(to))
function logout() { auth.logout(); navigateTo('/login') }
</script>

<template>
  <div class="flex min-h-screen">
    <div v-if="mobileOpen" class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" @click="mobileOpen = false" />
    <aside class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0" :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'">
      <div class="flex items-center gap-2 px-5 py-5">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg text-white">⏱</div>
        <div><p class="font-bold text-slate-800">TimeMint</p><p class="text-xs text-slate-400">ระบบลงเวลาพนักงาน</p></div>
      </div>
      <nav class="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div v-for="g in visible" :key="g.title">
          <p class="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ g.title }}</p>
          <NuxtLink v-for="i in g.items" :key="i.to" :to="i.to" class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition" :class="isActive(i.to) ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'">
            <span class="w-5 text-center">{{ i.icon }}</span>{{ i.label }}
          </NuxtLink>
        </div>
      </nav>
      <div class="border-t border-slate-100 p-4">
        <div class="mb-3 flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">{{ auth.user?.name?.[0] }}</div>
          <div class="min-w-0"><p class="truncate text-sm font-medium">{{ auth.user?.name }}</p><p class="text-xs text-slate-400">{{ ROLE_LABELS[auth.role] }}</p></div>
        </div>
        <button class="btn-secondary w-full" @click="logout">ออกจากระบบ</button>
      </div>
    </aside>
    <div class="flex min-w-0 flex-1 flex-col lg:pl-64">
      <header class="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <button class="rounded-lg p-2 hover:bg-slate-100" aria-label="เมนู" @click="mobileOpen = true">☰</button>
        <span class="font-bold">TimeMint</span>
      </header>
      <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"><slot /></main>
    </div>
  </div>
</template>
