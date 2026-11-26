<script setup>
import { STATUS } from '~/utils/constants'
import { apiError, fmtDate } from '~/utils/format'

definePageMeta({ roles: ['admin'] })

const api = useApi()
const toast = useToast()

const filters = [{ key: '', label: 'ทั้งหมด' }, ...['pending', 'approved', 'rejected', 'cancelled'].map((key) => ({ key, label: STATUS[key].label }))]
const status = ref('')
const rows = ref([])
const loading = ref(true)
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const { data } = await api.get('/leaves', { params: status.value ? { status: status.value } : {} })
    if (mine === seq) rows.value = data // server returns pending first
  } catch (e) {
    if (mine === seq) { rows.value = []; toast.error(apiError(e)) }
  } finally {
    if (mine === seq) loading.value = false
  }
}
onMounted(load)
watch(status, load)

const busyId = ref(null)
const showReject = ref(false)
const rejectTarget = ref(null)

async function review(row, action, body, message) {
  busyId.value = row.id
  try {
    await api.post(`/leaves/${row.id}/${action}`, body)
    toast.success(message)
    showReject.value = false
    await load()
  } catch (e) {
    toast.error(apiError(e))
    await load()
  } finally {
    busyId.value = null
  }
}
const approve = (row) => review(row, 'approve', {}, 'อนุมัติการลาแล้ว')
const reject = (reason) => review(rejectTarget.value, 'reject', { reason }, 'ไม่อนุมัติคำขอแล้ว')
function askReject(row) {
  rejectTarget.value = row
  showReject.value = true
}
const range = (r) => (r.start_date === r.end_date ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} - ${fmtDate(r.end_date)}`)

const statusOptions = filters.filter((f) => f.key).map((f) => ({ value: f.key, label: f.label }))
const columns = [
  { key: 'user_name', label: 'พนักงาน', text: (r) => `${r.user_name} ${r.emp_code || ''}`, class: 'whitespace-nowrap' },
  { key: 'department', label: 'แผนก', filter: 'select', class: 'whitespace-nowrap' },
  { key: 'type_label', label: 'ประเภท', filter: 'select', class: 'whitespace-nowrap' },
  { key: 'start_date', label: 'วันที่ลา', filter: 'date', text: range, class: 'whitespace-nowrap' },
  { key: 'days', label: 'จำนวน', text: (r) => `${r.days} วัน`, class: 'whitespace-nowrap' },
  { key: 'reason', label: 'เหตุผล', class: 'min-w-[12rem] break-words' },
  { key: 'status', label: 'สถานะ', filter: 'select', options: statusOptions, text: (r) => STATUS[r.status]?.label || r.status, class: 'min-w-[10rem]' },
]
</script>

<template>
  <div>
    <PageHeader title="อนุมัติการลา" subtitle="คำขอที่รออนุมัติแสดงก่อน" />

    <div class="mb-4 flex flex-wrap gap-2">
      <button v-for="f in filters" :key="f.key" class="btn-sm" :class="status === f.key ? 'btn-primary' : 'btn-secondary'" @click="status = f.key">{{ f.label }}</button>
    </div>

    <DataTable class="[&_thead_input]:min-w-[7rem] [&_thead_select]:min-w-[6.5rem]" :columns="columns" :rows="rows" :loading="loading" empty-text="ไม่มีคำขอลา">
      <template #cell-user_name="{ row }">
        <p class="font-medium text-slate-800">{{ row.user_name }}</p>
        <p class="text-xs text-slate-400">{{ row.emp_code }}</p>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :status="row.status" />
        <p v-if="row.reject_reason" class="mt-1 break-words text-xs text-rose-600">เหตุผลที่ไม่อนุมัติ: {{ row.reject_reason }}</p>
      </template>
      <template #actions="{ row }">
        <div v-if="row.status === 'pending'" class="flex justify-end gap-2">
          <button class="btn-primary btn-sm whitespace-nowrap" :disabled="busyId !== null" @click="approve(row)"><Spinner v-if="busyId === row.id" class="h-4 w-4" />อนุมัติ</button>
          <button class="btn-danger btn-sm whitespace-nowrap" :disabled="busyId !== null" @click="askReject(row)">ไม่อนุมัติ</button>
        </div>
      </template>
    </DataTable>

    <ReasonModal v-model="showReject" title="ไม่อนุมัติการลา" label="เหตุผลที่ไม่อนุมัติ" confirm-text="ไม่อนุมัติ" :loading="busyId !== null" @confirm="reject" />
  </div>
</template>
