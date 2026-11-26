<script setup>
import { CHECKIN_MODES, LEAVE_TYPES } from '~/utils/constants'
import { dayjs, fmtDate, fmtTime, fmtMoney, fmtNumber, fmtMinutes, apiError } from '~/utils/format'

const auth = useAuthStore()
const api = useApi()
const toast = useToast()

const data = ref(null)
const loading = ref(true)
const selected = ref(null)
const detailOpen = ref(false)

const now = useNow({ interval: 1000 })
const clock = computed(() => dayjs(now.value).format('HH:mm:ss'))
const dateText = computed(() => dayjs(now.value).format('วันddddที่ D MMMM YYYY'))
const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 12) return 'สวัสดีตอนเช้า'
  if (h < 17) return 'สวัสดีตอนบ่าย'
  return 'สวัสดีตอนเย็น'
})

const today = computed(() => data.value?.today)
const lateToday = computed(() => (today.value && today.value.status !== 'rejected' ? today.value.late_minutes : 0))
const cta = computed(() => {
  const t = today.value
  if (!t) return { title: 'ลงเวลาเข้างาน', hint: 'วันนี้ยังไม่ได้ลงเวลา', icon: '⏰' }
  if (t.status === 'rejected') return { title: 'การลงเวลาไม่ได้รับอนุมัติ', hint: t.reject_reason || 'ดูรายละเอียดที่หน้าลงเวลา', icon: '⛔' }
  if (!t.check_out_at) return { title: 'ลงเวลาออกงาน', hint: `เข้างานแล้วเวลา ${fmtTime(t.check_in_at)} น.`, icon: '🏃' }
  return { title: 'ลงเวลาวันนี้ครบแล้ว', hint: `เข้า ${fmtTime(t.check_in_at)} น. · ออก ${fmtTime(t.check_out_at)} น.`, icon: '✅' }
})

const quotaLeaves = computed(() => (data.value?.leave_balances || []).filter((b) => b.quota != null))
const uncappedLeaves = computed(() => (data.value?.leave_balances || []).filter((b) => b.quota == null))
const vacationLeft = computed(() => {
  const v = data.value?.leave_balances.find((b) => b.type === 'vacation')
  return v ? Math.max(0, v.quota - v.used) : 0
})
const barColor = (b) => (b.used >= b.quota ? 'rose' : b.used / b.quota >= 0.75 ? 'amber' : 'brand')

const pendingCards = computed(() => {
  const p = data.value?.pending
  if (!p) return []
  return [
    { to: '/admin/attendance', label: 'WFH รออนุมัติ', count: p.wfh, icon: '🏠' },
    { to: '/admin/leaves', label: 'การลารออนุมัติ', count: p.leaves, icon: '🌴' },
    { to: '/admin/ot', label: 'OT รออนุมัติ', count: p.ot, icon: '🌙' },
  ]
})

function openDetail(a) {
  selected.value = a
  detailOpen.value = true
}

async function load() {
  loading.value = true
  try {
    data.value = (await api.get('/dashboard/me')).data
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <div>
    <PageHeader :title="`${greeting}, ${auth.user?.name || ''}`" :subtitle="dateText">
      <span class="text-2xl font-bold tabular-nums text-brand-700">{{ clock }}</span>
    </PageHeader>

    <LoadingBlock v-if="loading" />

    <div v-else-if="!data" class="card flex flex-col items-center">
      <EmptyState icon="⛔" text="โหลดข้อมูลไม่สำเร็จ" />
      <button class="btn-secondary" @click="load">ลองใหม่</button>
    </div>

    <div v-else class="space-y-6">
      <div v-if="lateToday > 0" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ วันนี้คุณมาสาย {{ fmtMinutes(lateToday) }}
      </div>

      <NuxtLink to="/checkin" class="flex items-center gap-4 rounded-2xl bg-brand-600 p-5 text-white shadow-sm transition hover:bg-brand-700 sm:p-6">
        <span class="text-4xl">{{ cta.icon }}</span>
        <div class="min-w-0 flex-1">
          <p class="text-lg font-bold sm:text-2xl">{{ cta.title }}</p>
          <p class="text-sm text-brand-50">{{ cta.hint }}</p>
          <div v-if="today" class="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge :status="today.status" />
            <span class="text-xs text-brand-50">{{ CHECKIN_MODES[today.mode]?.label }}</span>
          </div>
        </div>
        <span class="text-2xl">→</span>
      </NuxtLink>

      <div v-if="pendingCards.length" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NuxtLink v-for="c in pendingCards" :key="c.to" :to="c.to" class="block min-w-0 rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md">
          <StatCard :label="c.label" :value="`${fmtNumber(c.count)} รายการ`" :icon="c.icon" :tone="c.count ? 'amber' : 'slate'" />
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="มาสายเดือนนี้" :value="`${fmtNumber(data.late.month_count)} ครั้ง`" :hint="`รวม ${fmtMinutes(data.late.month_minutes)}`" icon="⏱" :tone="data.late.month_count ? 'amber' : 'brand'" />
        <StatCard label="มาสายสะสมทั้งหมด" :value="`${fmtNumber(data.late.count)} ครั้ง`" :hint="`รวม ${fmtMinutes(data.late.minutes)}`" icon="📊" tone="slate" />
        <StatCard label="พักร้อนคงเหลือ" :value="`${fmtNumber(vacationLeft)} วัน`" hint="ปีนี้" icon="🏖️" tone="sky" />
        <NuxtLink to="/warnings" class="block min-w-0 rounded-2xl transition hover:shadow-md">
          <StatCard class="h-full" label="ใบเตือนที่มีผล" :value="`${fmtNumber(data.active_warnings)} ใบ`" hint="ดูรายละเอียด" icon="📝" :tone="data.active_warnings ? 'rose' : 'slate'" />
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section class="card min-w-0">
          <div class="mb-4 flex items-center justify-between gap-2">
            <h2 class="font-semibold text-slate-800">วันลาที่ใช้ไปปีนี้</h2>
            <NuxtLink to="/leave" class="text-sm font-medium text-brand-700 hover:underline">ขอลา →</NuxtLink>
          </div>
          <div class="space-y-4">
            <ProgressBar v-for="b in quotaLeaves" :key="b.type" :value="b.used" :max="b.quota" :label="`${LEAVE_TYPES[b.type]?.icon || ''} ${b.label} (เหลือ ${Math.max(0, b.quota - b.used)} วัน)`" :color="barColor(b)" suffix=" วัน" />
            <div v-for="b in uncappedLeaves" :key="b.type" class="flex justify-between text-xs">
              <span class="font-medium text-slate-600">{{ LEAVE_TYPES[b.type]?.icon }} {{ b.label }}</span>
              <span class="text-slate-500">ใช้ไป {{ b.used }} วัน</span>
            </div>
          </div>
        </section>

        <div class="min-w-0 space-y-6">
          <section class="card">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-slate-800">💰 OT เดือนนี้</h2>
              <NuxtLink to="/ot" class="text-sm font-medium text-brand-700 hover:underline">ขอ OT →</NuxtLink>
            </div>
            <p class="mt-3 break-words text-3xl font-bold text-brand-700">{{ fmtMoney(data.ot.amount) }}</p>
            <p class="mt-1 text-sm text-slate-500">อนุมัติแล้ว {{ fmtNumber(data.ot.hours) }} ชั่วโมง · รออนุมัติ {{ fmtNumber(data.ot.pending) }} รายการ</p>
          </section>

          <section class="card">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h2 class="font-semibold text-slate-800">📢 ประกาศล่าสุด</h2>
              <NuxtLink to="/announcements" class="text-sm font-medium text-brand-700 hover:underline">ดูทั้งหมด →</NuxtLink>
            </div>
            <button v-if="data.next_event" class="mb-3 block w-full rounded-xl bg-sky-50 px-3 py-2 text-left text-sm text-sky-800 hover:bg-sky-100" @click="openDetail(data.next_event)">
              <span class="block text-xs font-medium">🎉 กิจกรรมถัดไป · {{ fmtDate(data.next_event.event_date) }}</span>
              <span class="block break-words font-semibold">{{ data.next_event.title }}</span>
            </button>
            <EmptyState v-if="!data.announcements.length" text="ยังไม่มีประกาศ" />
            <ul v-else class="divide-y divide-slate-100">
              <li v-for="a in data.announcements" :key="a.id" class="min-w-0">
                <button class="block w-full rounded-lg px-1 py-2 text-left hover:bg-slate-50" @click="openDetail(a)">
                  <p class="truncate text-sm font-medium text-slate-800">{{ a.pinned ? '📌 ' : '' }}{{ a.title }}</p>
                  <p class="truncate text-xs text-slate-500">{{ a.body }}</p>
                  <p class="text-xs text-slate-400">{{ a.type === 'event' ? 'กิจกรรม' : 'ข่าวสาร' }} · {{ fmtDate(a.created_at) }}</p>
                </button>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>

    <AppModal v-model="detailOpen" :title="selected?.title">
      <p v-if="selected?.event_date" class="mb-2 text-sm font-medium text-sky-700">📅 วันจัดกิจกรรม {{ fmtDate(selected.event_date) }}</p>
      <p class="whitespace-pre-line break-words text-sm text-slate-600">{{ selected?.body }}</p>
    </AppModal>
  </div>
</template>
