<script setup>
import { STATUS } from '~/utils/constants'
import { fmtDate, fmtMoney, fmtNumber, apiError } from '~/utils/format'
definePageMeta({ roles: ['admin'] })

const api = useApi()
const toast = useToast()

const tabs = [
  { key: 'pending', label: 'รออนุมัติ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ไม่อนุมัติ' },
  { key: '', label: 'ทั้งหมด' },
]
const status = ref('pending')
const search = ref('')
const month = ref('')
const loading = ref(true)
const rows = ref([])

let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const { data } = await api.get('/ot', { params: status.value ? { status: status.value } : {} })
    if (mine === seq) rows.value = data
  } catch (e) {
    if (mine === seq) { rows.value = []; toast.error(apiError(e)) }
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch(status, load, { immediate: true })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value.filter((r) =>
    (!q || `${r.user_name} ${r.emp_code} ${r.department || ''}`.toLowerCase().includes(q)) &&
    (!month.value || r.date.startsWith(month.value)))
})
const totalHours = computed(() => Math.round(filtered.value.reduce((s, r) => s + r.hours, 0) * 100) / 100)
const totalAmount = computed(() => filtered.value.reduce((s, r) => s + (r.status === 'rejected' ? 0 : r.estimated_amount), 0))

const target = ref(null)
const approveOpen = ref(false)
const rejectOpen = ref(false)
const busy = ref(false)
// flags are set here, not passed from the template: templates auto-unwrap refs
const askApprove = (row) => { target.value = row; approveOpen.value = true }
const askReject = (row) => { target.value = row; rejectOpen.value = true }

async function act(path, body, message, flag) {
  busy.value = true
  try {
    const { data } = await api.post(`/ot/${target.value.id}/${path}`, body)
    toast.success(data.status === 'approved' ? `${message} ${fmtMoney(data.amount)}` : message)
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    flag.value = false
    busy.value = false
    await load()
  }
}
const approve = () => act('approve', {}, 'อนุมัติ OT แล้ว', approveOpen)
const reject = (reason) => act('reject', { reason }, 'ไม่อนุมัติคำขอแล้ว', rejectOpen)
const approveMessage = computed(() => (target.value
  ? `อนุมัติ OT ของ ${target.value.user_name} วันที่ ${fmtDate(target.value.date)} จำนวน ${fmtNumber(target.value.hours)} ชม. ยอดเงินโดยประมาณ ${fmtMoney(target.value.estimated_amount)}`
  : ''))

const statusOptions = tabs.filter((t) => t.key).map((t) => ({ value: t.key, label: STATUS[t.key]?.label || t.label }))
const amountText = (r) => (r.status === 'rejected' ? '-' : fmtMoney(r.estimated_amount))
const columns = [
  { key: 'user_name', label: 'พนักงาน', text: (r) => `${r.user_name} ${r.emp_code || ''}` },
  { key: 'department', label: 'แผนก', filter: 'select' },
  { key: 'date', label: 'วันที่ / เวลา', filter: 'date', text: (r) => `${fmtDate(r.date)} ${r.start_time} - ${r.end_time}`, class: 'whitespace-nowrap' },
  { key: 'hours', label: 'ชม.', text: (r) => fmtNumber(r.hours) },
  { key: 'reason', label: 'เหตุผล', class: 'min-w-[9rem] break-words' },
  { key: 'estimated_amount', label: 'ยอดเงิน', value: (r) => (r.status === 'rejected' ? null : r.estimated_amount), text: amountText, class: 'whitespace-nowrap' },
  { key: 'status', label: 'สถานะ', filter: 'select', options: statusOptions, text: (r) => STATUS[r.status]?.label || r.status },
]
</script>

<template>
  <div>
    <PageHeader title="อนุมัติ OT" />

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button v-for="t in tabs" :key="t.key" class="btn-sm" :class="status === t.key ? 'btn-primary' : 'btn-secondary'" @click="status = t.key">{{ t.label }}</button>
      <input v-model="search" class="input sm:ml-auto sm:w-64" placeholder="ค้นหาชื่อ / รหัส / แผนก">
      <div class="w-full sm:w-52" role="group" aria-label="เดือน"><DateInput v-model="month" type="month" clearable placeholder="ทุกเดือน" /></div>
    </div>

    <p v-if="!loading && filtered.length" class="mb-2 text-sm text-slate-500">{{ filtered.length }} รายการ · {{ fmtNumber(totalHours) }} ชม. · {{ fmtMoney(totalAmount) }}<span v-if="!status"> (ไม่รวมที่ไม่อนุมัติ)</span></p>
    <DataTable
      class="[&_td]:px-2 [&_th]:px-2 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[1] [&_td:first-child]:bg-white [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-[1] [&_thead_input]:min-w-[6rem] [&_thead_input[type=date]]:min-w-[8.5rem] [&_thead_select]:min-w-[6.5rem]"
      :columns="columns" :rows="filtered" :loading="loading" empty-text="ไม่มีคำขอ OT"
    >
      <template #cell-user_name="{ row }">
        <div class="max-w-[11rem]">
          <p class="font-medium text-slate-800">{{ row.user_name }}</p>
          <p class="text-xs text-slate-400">{{ row.emp_code }}</p>
        </div>
      </template>
      <template #cell-date="{ row }">
        <p>{{ fmtDate(row.date) }}</p>
        <p class="text-xs text-slate-500">{{ row.start_time }} - {{ row.end_time }}</p>
      </template>
      <template #cell-estimated_amount="{ row }">
        {{ amountText(row) }}<span v-if="row.status === 'pending'" class="block text-xs text-slate-400">(ประมาณ)</span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :status="row.status" />
        <p v-if="row.reject_reason" class="mt-1 min-w-[7rem] text-xs text-rose-600">เหตุผล: {{ row.reject_reason }}</p>
      </template>
      <template #actions="{ row }">
        <div v-if="row.status === 'pending'" class="flex justify-end gap-2">
          <button class="btn-primary btn-sm whitespace-nowrap" @click="askApprove(row)">อนุมัติ</button>
          <button class="btn-danger btn-sm whitespace-nowrap" @click="askReject(row)">ไม่อนุมัติ</button>
        </div>
      </template>
    </DataTable>

    <ConfirmModal v-model="approveOpen" title="อนุมัติ OT" :message="approveMessage" confirm-text="อนุมัติ" :loading="busy" @confirm="approve" />
    <ReasonModal v-model="rejectOpen" title="ไม่อนุมัติ OT" confirm-text="ไม่อนุมัติ" :loading="busy" @confirm="reject" />
  </div>
</template>
