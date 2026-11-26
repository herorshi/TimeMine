<script setup>
import { CHECKIN_MODES, STATUS } from '~/utils/constants'
import { dayjs, fmtDate, fmtDateLong, fmtTime, fmtMinutes, fmtNumber, apiError } from '~/utils/format'

const api = useApi()
const toast = useToast()
const auth = useAuthStore()
const { lateLevel } = useAppSettings()
const bannerClass = {
  yellow: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-rose-200 bg-rose-50 text-rose-700',
  none: 'border-slate-200 bg-slate-50 text-slate-600',
}
const toastType = { yellow: 'warning', red: 'error', none: 'info' }
const allowedModes = computed(() => Object.fromEntries(Object.entries(CHECKIN_MODES).filter(([key]) => auth.can(`checkin.${key}`))))
const canCheckIn = computed(() => Object.keys(allowedModes.value).length > 0)

const now = ref(new Date())
useIntervalFn(() => {
  const next = new Date()
  const dayChanged = next.toDateString() !== now.value.toDateString()
  now.value = next
  if (dayChanged) load()
}, 1000)

const loading = ref(true)
const busy = ref('') // mode being checked in, or 'out'
const today = ref(null)
const history = ref([])
const late = ref({ count: 0, minutes: 0, month_count: 0, month_minutes: 0 })
const note = ref('')
const scanOpen = ref(false)
const confirmOut = ref(false)
const needEnroll = ref(false)
const mismatch = ref('') // face mismatch message, with an immediate retry

const timeText = (v) => (v ? fmtTime(v) : null)
const historyColumns = [
  { key: 'date', label: 'วันที่', filter: 'date', text: (r) => fmtDate(r.date) },
  { key: 'mode', label: 'รูปแบบ', filter: 'select', text: (r) => `${CHECKIN_MODES[r.mode]?.icon || ''} ${CHECKIN_MODES[r.mode]?.label || r.mode}`.trim() },
  { key: 'check_in_at', label: 'เข้า', value: (r) => timeText(r.check_in_at), text: (r) => fmtTime(r.check_in_at) },
  { key: 'check_out_at', label: 'ออก', value: (r) => timeText(r.check_out_at), text: (r) => fmtTime(r.check_out_at) },
  { key: 'late_minutes', label: 'มาสาย', value: (r) => (r.late_minutes > 0 ? r.late_minutes : null), text: (r) => (r.late_minutes > 0 ? `สาย ${fmtMinutes(r.late_minutes)}` : '-') },
  { key: 'status', label: 'สถานะ', filter: 'select', text: (r) => STATUS[r.status]?.label || r.status },
]

async function load() {
  try {
    const [t, h, l] = await Promise.all([
      api.get('/attendance/today'),
      api.get('/attendance/me'),
      api.get('/attendance/me/late-summary', { params: { month: dayjs().format('YYYY-MM') } }),
    ])
    today.value = t.data || null
    history.value = h.data
    late.value = l.data
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function pick(mode) {
  mismatch.value = ''
  needEnroll.value = false
  if (mode === 'building') startScan()
  else checkIn(mode)
}
async function startScan() {
  if (busy.value) return
  busy.value = 'building'
  mismatch.value = ''
  try {
    const { data } = await api.get('/face/status')
    needEnroll.value = !data.enrolled
    scanOpen.value = !!data.enrolled
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    busy.value = ''
  }
}
function onEnrollChanged(enrolled) {
  if (!enrolled) return
  needEnroll.value = false
  scanOpen.value = true
}
function onCaptured(descriptor) {
  scanOpen.value = false
  checkIn('building', Array.from(descriptor))
}
async function checkIn(mode, descriptor) {
  if (busy.value) return
  busy.value = mode
  try {
    const { data } = await api.post('/attendance/check-in', { mode, descriptor, note: note.value })
    today.value = data
    note.value = ''
    toast.success(mode === 'wfh' ? 'ส่งคำขอ WFH แล้ว รออนุมัติ' : 'ลงเวลาเข้างานแล้ว')
    if (data.late_minutes > 0) toast[toastType[lateLevel(data.late_minutes)]](`มาสาย ${fmtMinutes(data.late_minutes)}`)
    await load()
  } catch (e) {
    const message = apiError(e)
    if (message.includes('ใบหน้าไม่ตรง')) mismatch.value = message
    toast.error(message)
  } finally {
    busy.value = ''
  }
}
async function checkOut() {
  busy.value = 'out'
  try {
    const { data } = await api.post('/attendance/check-out')
    today.value = data
    confirmOut.value = false
    toast.success('ลงเวลาออกงานแล้ว')
    await load()
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div>
    <PageHeader title="ลงเวลาเข้า-ออกงาน" />
    <LoadingBlock v-if="loading" />
    <div v-else class="space-y-5">
      <div v-if="today?.late_minutes > 0" class="rounded-2xl border px-4 py-3 text-sm font-medium" :class="bannerClass[lateLevel(today.late_minutes)]">
        ⚠️ มาสาย {{ fmtMinutes(today.late_minutes) }}
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div class="card flex min-w-0 flex-col items-center justify-center text-center">
          <p class="text-sm text-slate-500">{{ fmtDateLong(now) }}</p>
          <p class="mt-2 text-5xl font-bold tabular-nums text-slate-800">{{ dayjs(now).format('HH:mm:ss') }}</p>
        </div>

        <div class="card min-w-0">
          <h2 class="mb-3 font-semibold">สถานะวันนี้</h2>
          <template v-if="today">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span>{{ CHECKIN_MODES[today.mode]?.icon }} {{ CHECKIN_MODES[today.mode]?.label }}</span>
              <StatusBadge :status="today.status" />
              <LateBadge v-if="today.late_minutes > 0" :minutes="today.late_minutes" />
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3 text-center">
              <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">เข้างาน</p><p class="text-xl font-bold">{{ fmtTime(today.check_in_at) }}</p></div>
              <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">ออกงาน</p><p class="text-xl font-bold">{{ fmtTime(today.check_out_at) }}</p></div>
            </div>
            <p v-if="today.reject_reason" class="mt-3 break-words text-sm text-rose-600">เหตุผลที่ไม่อนุมัติ: {{ today.reject_reason }}</p>
            <button v-if="!today.check_out_at && today.status !== 'rejected'" class="btn-primary mt-4 w-full" :disabled="!!busy" @click="confirmOut = true">ลงเวลาออกงาน</button>
          </template>
          <p v-else class="text-sm text-slate-500">ยังไม่ได้ลงเวลาเข้างานวันนี้</p>
        </div>
      </div>

      <div v-if="!today" class="card">
        <h2 class="mb-3 font-semibold">ลงเวลาเข้างาน</h2>
        <p v-if="!canCheckIn" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">คุณไม่ได้รับสิทธิ์ลงเวลา กรุณาติดต่อผู้บริหาร</p>
        <template v-else>
        <label class="label">หมายเหตุ (ไม่บังคับ)</label>
        <input v-model="note" class="input mb-4" placeholder="พิมพ์หมายเหตุ...">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button v-for="(m, key) in allowedModes" :key="key" class="btn-secondary flex-col py-5" :disabled="!!busy" @click="pick(key)">
            <Spinner v-if="busy === key" />
            <span v-else class="text-3xl">{{ m.icon }}</span>
            <span>{{ m.label }}</span>
          </button>
        </div>
        <div v-if="mismatch" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <span>{{ mismatch }}</span>
          <button type="button" class="btn-primary" :disabled="!!busy" @click="startScan">สแกนอีกครั้ง</button>
        </div>
        <div v-if="needEnroll" class="mt-4 space-y-3">
          <p class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">การลงเวลาแบบเข้าอาคารต้องยืนยันใบหน้า คุณยังไม่ได้ลงทะเบียนใบหน้า กรุณาลงทะเบียนด้านล่าง จากนั้นระบบจะเปิดกล้องสแกนเข้างานต่อให้ทันที</p>
          <FaceEnroll @changed="onEnrollChanged" />
        </div>
        </template>
      </div>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="มาสายเดือนนี้" :value="`${fmtNumber(late.month_count)} ครั้ง`" tone="amber" />
        <StatCard label="เวลาสายเดือนนี้" :value="fmtMinutes(late.month_minutes)" tone="amber" />
        <StatCard label="มาสายทั้งหมด" :value="`${fmtNumber(late.count)} ครั้ง`" tone="rose" />
        <StatCard label="เวลาสายทั้งหมด" :value="fmtMinutes(late.minutes)" tone="rose" />
      </div>

      <div class="min-w-0">
        <h2 class="mb-3 font-semibold">ประวัติการลงเวลา</h2>
        <DataTable :columns="historyColumns" :rows="history" row-key="id" empty-text="ยังไม่มีประวัติการลงเวลา" class="whitespace-nowrap">
          <template #cell-late_minutes="{ row }"><LateBadge :minutes="row.late_minutes" /></template>
          <template #cell-status="{ row }">
            <StatusBadge :status="row.status" />
            <p v-if="row.reject_reason" class="mt-1 w-48 whitespace-normal break-words text-xs text-rose-600">{{ row.reject_reason }}</p>
          </template>
        </DataTable>
      </div>
    </div>

    <FaceScanner v-model="scanOpen" title="สแกนใบหน้าเพื่อเข้างาน" @captured="onCaptured" />
    <ConfirmModal v-model="confirmOut" title="ลงเวลาออกงาน" message="ยืนยันการลงเวลาออกงานตอนนี้?" :loading="busy === 'out'" @confirm="checkOut" />
  </div>
</template>
