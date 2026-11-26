<script setup>
import { CHECKIN_MODES } from '~/utils/constants'
import { dayjs, fmtDate, fmtTime, fmtMinutes, fmtNumber, apiError } from '~/utils/format'

const api = useApi()
const toast = useToast()

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
  if (mode === 'building') scanOpen.value = true
  else checkIn(mode)
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
    if (data.late_minutes > 0) toast.warning(`มาสาย ${fmtMinutes(data.late_minutes)}`)
    await load()
  } catch (e) {
    toast.error(apiError(e))
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
      <div v-if="today?.late_minutes > 0" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        ⚠️ มาสาย {{ fmtMinutes(today.late_minutes) }}
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <div class="card flex flex-col items-center justify-center text-center">
          <p class="text-sm text-slate-500">{{ dayjs(now).format('dddd D MMMM YYYY') }}</p>
          <p class="mt-2 text-5xl font-bold tabular-nums text-slate-800">{{ dayjs(now).format('HH:mm:ss') }}</p>
        </div>

        <div class="card">
          <h2 class="mb-3 font-semibold">สถานะวันนี้</h2>
          <template v-if="today">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span>{{ CHECKIN_MODES[today.mode]?.icon }} {{ CHECKIN_MODES[today.mode]?.label }}</span>
              <StatusBadge :status="today.status" />
              <StatusBadge v-if="today.late_minutes > 0" color="amber" :label="`สาย ${fmtMinutes(today.late_minutes)}`" />
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
        <label class="label">หมายเหตุ (ไม่บังคับ)</label>
        <input v-model="note" class="input mb-4" placeholder="พิมพ์หมายเหตุ...">
        <div class="grid gap-3 sm:grid-cols-3">
          <button v-for="(m, key) in CHECKIN_MODES" :key="key" class="btn-secondary flex-col py-5" :disabled="!!busy" @click="pick(key)">
            <Spinner v-if="busy === key" />
            <span v-else class="text-3xl">{{ m.icon }}</span>
            <span>{{ m.label }}</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="มาสายเดือนนี้" :value="`${fmtNumber(late.month_count)} ครั้ง`" tone="amber" />
        <StatCard label="เวลาสายเดือนนี้" :value="fmtMinutes(late.month_minutes)" tone="amber" />
        <StatCard label="มาสายทั้งหมด" :value="`${fmtNumber(late.count)} ครั้ง`" tone="rose" />
        <StatCard label="เวลาสายทั้งหมด" :value="fmtMinutes(late.minutes)" tone="rose" />
      </div>

      <div>
        <h2 class="mb-3 font-semibold">ประวัติการลงเวลา</h2>
        <div v-if="!history.length" class="card"><EmptyState text="ยังไม่มีประวัติการลงเวลา" /></div>
        <div v-else class="table-wrap">
          <table class="table whitespace-nowrap">
            <thead><tr><th>วันที่</th><th>รูปแบบ</th><th>เข้า</th><th>ออก</th><th>มาสาย</th><th>สถานะ</th></tr></thead>
            <tbody>
              <tr v-for="r in history" :key="r.id">
                <td>{{ fmtDate(r.date) }}</td>
                <td>{{ CHECKIN_MODES[r.mode]?.icon }} {{ CHECKIN_MODES[r.mode]?.label }}</td>
                <td>{{ fmtTime(r.check_in_at) }}</td>
                <td>{{ fmtTime(r.check_out_at) }}</td>
                <td><StatusBadge v-if="r.late_minutes > 0" color="amber" :label="`สาย ${fmtMinutes(r.late_minutes)}`" /><span v-else>-</span></td>
                <td>
                  <StatusBadge :status="r.status" />
                  <p v-if="r.reject_reason" class="mt-1 max-w-xs whitespace-normal break-words text-xs text-rose-600">{{ r.reject_reason }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <FaceScanner v-model="scanOpen" title="สแกนใบหน้าเพื่อเข้างาน" @captured="onCaptured" />
    <ConfirmModal v-model="confirmOut" title="ลงเวลาออกงาน" message="ยืนยันการลงเวลาออกงานตอนนี้?" :loading="busy === 'out'" @confirm="checkOut" />
  </div>
</template>
