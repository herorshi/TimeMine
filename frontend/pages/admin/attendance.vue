<script setup>
import { CHECKIN_MODES, STATUS } from '~/utils/constants'
import { fmtDate, fmtTime, todayStr, apiError } from '~/utils/format'

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
              <StatusBadge v-if="r.late_minutes > 0" color="amber" :label="`สาย ${r.late_minutes} นาที`" />
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
        <LoadingBlock v-if="listLoading" />
        <div v-else-if="!rows.length" class="card"><EmptyState text="ไม่พบรายการ" /></div>
        <div v-else class="table-wrap">
          <table class="table whitespace-nowrap">
            <thead><tr><th>พนักงาน</th><th>วันที่</th><th>รูปแบบ</th><th>เข้า</th><th>ออก</th><th>มาสาย</th><th>สถานะ</th></tr></thead>
            <tbody>
              <tr v-for="r in rows" :key="r.id">
                <td><p class="font-medium">{{ r.name }}</p><p class="text-xs text-slate-400">{{ r.emp_code }} · {{ r.department || '-' }}</p></td>
                <td>{{ fmtDate(r.date) }}</td>
                <td>{{ CHECKIN_MODES[r.mode]?.icon }} {{ CHECKIN_MODES[r.mode]?.label }}</td>
                <td>{{ fmtTime(r.check_in_at) }}</td>
                <td>{{ fmtTime(r.check_out_at) }}</td>
                <td><StatusBadge v-if="r.late_minutes > 0" color="amber" :label="`สาย ${r.late_minutes} นาที`" /><span v-else>-</span></td>
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

    <ReasonModal v-model="rejectOpen" title="ไม่อนุมัติ WFH" :loading="busyId !== null" @confirm="reject" />
  </div>
</template>
