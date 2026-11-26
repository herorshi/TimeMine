<script setup>
import { CHECKIN_MODES, STATUS } from '~/utils/constants'
import { fmtDate, fmtTime, fmtMinutes, todayStr, apiError } from '~/utils/format'

definePageMeta({ roles: ['admin'] })

const api = useApi()
const toast = useToast()

const filters = reactive({ date: todayStr(), status: '', mode: '' })
const rows = ref([])
const queue = ref([])
const todayRows = ref([])
const loading = ref(true)
const listLoading = ref(false)
const busyId = ref(null)
const rejectOpen = ref(false)
const rejecting = ref(null)

const overview = computed(() => {
  const list = todayRows.value
  const count = (fn) => list.filter(fn).length
  return [
    { label: 'ลงเวลาวันนี้', value: list.length, tone: 'brand' },
    { label: 'Office', value: count((r) => r.mode === 'office'), tone: 'sky' },
    { label: 'ที่ตึก', value: count((r) => r.mode === 'building'), tone: 'violet' },
    { label: 'WFH', value: count((r) => r.mode === 'wfh'), tone: 'slate' },
    { label: 'มาสาย', value: count((r) => r.late_minutes > 0 && r.status !== 'rejected'), tone: 'amber' },
    { label: 'WFH รออนุมัติ (ทั้งหมด)', value: queue.value.length, tone: 'rose' },
  ]
})

let seq = 0
async function loadList() {
  const mine = ++seq
  listLoading.value = true
  try {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    const { data } = await api.get('/attendance', { params })
    if (mine === seq) rows.value = data
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    if (mine === seq) listLoading.value = false
  }
}
async function loadSummary() {
  try {
    const [q, t] = await Promise.all([
      api.get('/attendance', { params: { status: 'pending', mode: 'wfh' } }),
      api.get('/attendance', { params: { date: todayStr() } }),
    ])
    queue.value = q.data
    todayRows.value = t.data
  } catch (e) {
    toast.error(apiError(e))
  }
}
const refresh = () => Promise.all([loadList(), loadSummary()])
onMounted(async () => { await refresh(); loading.value = false })
watch(filters, loadList)

const lateText = (r) => (r.late_minutes > 0 ? `สาย ${fmtMinutes(r.late_minutes)}` : '-')
const nowrap = 'whitespace-nowrap'
const columns = [
  { key: 'name', label: 'พนักงาน', text: (r) => `${r.name} ${r.emp_code}`, class: nowrap },
  { key: 'department', label: 'แผนก', filter: 'select', value: (r) => r.department || '-', class: nowrap },
  { key: 'date', label: 'วันที่', filter: 'date', text: (r) => fmtDate(r.date), class: nowrap },
  { key: 'mode', label: 'รูปแบบ', filter: 'select', options: Object.entries(CHECKIN_MODES).map(([value, m]) => ({ value, label: m.label })), text: (r) => `${CHECKIN_MODES[r.mode]?.icon || ''} ${CHECKIN_MODES[r.mode]?.label || r.mode}`, class: nowrap },
  { key: 'check_in_at', label: 'เข้า', text: (r) => fmtTime(r.check_in_at), class: nowrap },
  { key: 'check_out_at', label: 'ออก', text: (r) => fmtTime(r.check_out_at), class: nowrap },
  { key: 'late_minutes', label: 'มาสาย', text: lateText, class: nowrap },
  { key: 'status', label: 'สถานะ', filter: 'select', options: ['pending', 'approved', 'rejected'].map((value) => ({ value, label: STATUS[value].label })), class: nowrap },
  { key: 'reject_reason', label: 'เหตุผลที่ไม่อนุมัติ', text: (r) => r.reject_reason || '-', class: 'min-w-[10rem] max-w-xs break-words' },
]

async function approve(r) {
  busyId.value = r.id
  try {
    await api.post(`/attendance/${r.id}/approve`)
    toast.success('อนุมัติแล้ว')
    await refresh()
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    busyId.value = null
  }
}
function askReject(r) {
  rejecting.value = r
  rejectOpen.value = true
}
async function reject(reason) {
  busyId.value = rejecting.value.id
  try {
    await api.post(`/attendance/${rejecting.value.id}/reject`, { reason })
    rejectOpen.value = false
    toast.success('บันทึกการไม่อนุมัติแล้ว')
    await refresh()
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader title="การเข้างาน / อนุมัติ WFH" />
    <LoadingBlock v-if="loading" />
    <div v-else class="space-y-6">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard v-for="o in overview" :key="o.label" :label="o.label" :value="o.value" :tone="o.tone" />
      </div>

      <div>
        <h2 class="mb-3 font-semibold">คำขอ WFH รออนุมัติ</h2>
        <div v-if="!queue.length" class="card"><EmptyState icon="✅" text="ไม่มีคำขอรออนุมัติ" /></div>
        <div v-else class="grid gap-3 md:grid-cols-2">
          <div v-for="r in queue" :key="r.id" class="card">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="font-semibold">{{ r.name }}</p>
                <p class="text-xs text-slate-500">{{ r.emp_code }} · {{ r.department || '-' }}</p>
              </div>
              <LateBadge v-if="r.late_minutes > 0" :minutes="r.late_minutes" />
            </div>
            <p class="mt-2 text-sm text-slate-600">{{ fmtDate(r.date) }} · เข้า {{ fmtTime(r.check_in_at) }}</p>
            <p v-if="r.note" class="mt-1 break-words text-sm text-slate-500">หมายเหตุ: {{ r.note }}</p>
            <div class="mt-3 flex justify-end gap-2">
              <button class="btn-danger btn-sm" :disabled="busyId !== null" @click="askReject(r)">ไม่อนุมัติ</button>
              <button class="btn-primary btn-sm" :disabled="busyId !== null" @click="approve(r)"><Spinner v-if="busyId === r.id" class="h-4 w-4" />อนุมัติ</button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 class="mb-3 font-semibold">รายการเข้างาน</h2>
        <div class="card mb-3 grid gap-3 sm:grid-cols-3">
          <div><label class="label">วันที่ (เว้นว่าง = ทุกวัน)</label><input v-model="filters.date" type="date" class="input"></div>
          <div>
            <label class="label">สถานะ</label>
            <select v-model="filters.status" class="input">
              <option value="">ทั้งหมด</option>
              <option v-for="s in ['pending', 'approved', 'rejected']" :key="s" :value="s">{{ STATUS[s].label }}</option>
            </select>
          </div>
          <div>
            <label class="label">รูปแบบ</label>
            <select v-model="filters.mode" class="input">
              <option value="">ทั้งหมด</option>
              <option v-for="(m, key) in CHECKIN_MODES" :key="key" :value="key">{{ m.label }}</option>
            </select>
          </div>
        </div>
        <DataTable :columns="columns" :rows="rows" row-key="id" :loading="listLoading" empty-text="ไม่พบรายการ">
          <template #cell-name="{ row }"><p class="font-medium">{{ row.name }}</p><p class="text-xs text-slate-400">{{ row.emp_code }}</p></template>
          <template #cell-late_minutes="{ row }"><LateBadge :minutes="row.late_minutes" /></template>
          <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
          <template #cell-reject_reason="{ row }"><span v-if="row.reject_reason" class="text-xs text-rose-600">{{ row.reject_reason }}</span><span v-else>-</span></template>
        </DataTable>
      </div>
    </div>

    <ReasonModal v-model="rejectOpen" title="ไม่อนุมัติ WFH" :loading="busyId !== null" @confirm="reject" />
  </div>
</template>
