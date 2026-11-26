<script setup>
import { CHECKIN_MODES, STATUS } from '~/utils/constants'
import { dayjs, fmtDate, fmtDateLong, fmtTime, fmtMinutes, fmtNumber, apiError } from '~/utils/format'

const api = useApi()
const toast = useToast()
const auth = useAuthStore()
const { lateLevel, settings } = useAppSettings()
const { getPosition } = useGeolocation()
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
const faceEnrolled = ref(null) // null = unknown
const location = ref(null) // { lat, lng, accuracy, at } from the last successful locate
const LOCATION_MAX_AGE_MS = 2 * 60 * 1000
const geofence = computed(() => !!(settings.value?.office_lat && settings.value?.office_lng))
const needsLocation = (mode) => geofence.value && (mode === 'office' || mode === 'building')
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
async function loadFaceStatus() {
  const { data } = await api.get('/face/status')
  faceEnrolled.value = !!data.enrolled
}
onMounted(() => {
  load()
  loadFaceStatus().catch(() => {}) // status hint only; startScan() re-checks and reports errors
})

// Position for a geofenced check-in. Reuses a fix newer than maxAgeMs; null (after a toast) on failure.
async function ensureLocation(maxAgeMs = 0) {
  const l = location.value
  if (l && Date.now() - l.at <= maxAgeMs) return l
  try {
    location.value = { ...(await getPosition()), at: Date.now() }
    return location.value
  } catch (e) {
    location.value = null
    toast.error(e.message)
    return null
  }
}
const toPayload = (l) => ({ lat: l.lat, lng: l.lng, accuracy: l.accuracy })

function pick(mode) {
  mismatch.value = ''
  if (mode === 'building') startScan()
  else checkIn(mode)
}
async function startScan() {
  if (busy.value) return
  busy.value = 'building'
  mismatch.value = ''
  try {
    if (needsLocation('building') && !(await ensureLocation(LOCATION_MAX_AGE_MS))) return
    await loadFaceStatus()
    scanOpen.value = faceEnrolled.value
    if (!faceEnrolled.value) toast.warning('กรุณาติดต่อ admin เพื่อลงทะเบียนใบหน้า')
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    busy.value = ''
  }
}
function onCaptured({ descriptor, photo }) {
  scanOpen.value = false
  checkIn('building', { descriptor, photo })
}
// on a face mismatch: the name of whoever the face was identified as ('' if the server does not say)
async function recognisedName(error, face) {
  let name = error.response.data?.user?.name
  if (!name) {
    try { name = (await api.post('/face/identify', face)).data?.user?.name } catch (e) { name = e?.response?.data?.user?.name }
  }
  return name && name !== auth.user?.name ? name : ''
}
async function checkIn(mode, face) {
  if (busy.value) return
  busy.value = mode
  try {
    let loc
    if (needsLocation(mode)) {
      // office: always a fresh fix; building: reuse the one taken before the scan unless it is stale
      const l = await ensureLocation(mode === 'building' ? LOCATION_MAX_AGE_MS : 0)
      if (!l) return
      loc = toPayload(l)
    }
    const { data } = await api.post('/attendance/check-in', { mode, ...face, ...(loc ? { location: loc } : {}), note: note.value })
    today.value = data
    note.value = ''
    toast.success(mode === 'wfh' ? 'ส่งคำขอ WFH แล้ว รออนุมัติ' : 'ลงเวลาเข้างานแล้ว')
    if (data.late_minutes > 0) toast[toastType[lateLevel(data.late_minutes)]](`มาสาย ${fmtMinutes(data.late_minutes)}`)
    await load()
  } catch (e) {
    const message = apiError(e)
    if (face && (e?.response?.status === 403 || message.includes('ใบหน้าไม่ตรง'))) {
      const name = await recognisedName(e, face)
      mismatch.value = name ? `${message} (ระบบระบุว่าเป็น: ${name})` : message
    }
    toast.error(mismatch.value || message)
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
            <div v-if="today.face_photo_url" class="mt-3 flex items-center gap-3">
              <img :src="today.face_photo_url" alt="รูปหลักฐานตอนลงเวลา" class="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <p class="text-xs text-slate-500">รูปหลักฐานการสแกนใบหน้าตอนเข้างาน</p>
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
        <p v-if="geofence" class="mt-3 text-sm text-slate-500">📍 Office และ Building ต้องอยู่ในรัศมี {{ settings.office_radius_m || 200 }} ม. จากตึก</p>
        <div v-if="mismatch" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <span>{{ mismatch }}</span>
          <button type="button" class="btn-primary" :disabled="!!busy" @click="startScan">สแกนอีกครั้ง</button>
        </div>
        <p v-if="allowedModes.building && faceEnrolled === false" class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">การลงเวลาแบบเข้าอาคารต้องยืนยันใบหน้า กรุณาติดต่อ admin เพื่อลงทะเบียนใบหน้า</p>
        <p v-else-if="allowedModes.building && faceEnrolled" class="mt-3 text-sm text-emerald-600">✓ ลงทะเบียนใบหน้าแล้ว</p>
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
