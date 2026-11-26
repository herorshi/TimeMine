<script setup>
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
const ask = (row, flag) => { target.value = row; flag.value = true }

async function act(path, body, message, flag) {
  busy.value = true
  try {
    await api.post(`/ot/${target.value.id}/${path}`, body)
    toast.success(message)
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
</script>

<template>
  <div>
    <PageHeader title="อนุมัติ OT" />

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button v-for="t in tabs" :key="t.key" class="btn-sm" :class="status === t.key ? 'btn-primary' : 'btn-secondary'" @click="status = t.key">{{ t.label }}</button>
      <input v-model="search" class="input sm:ml-auto sm:w-64" placeholder="ค้นหาชื่อ / รหัส / แผนก">
      <input v-model="month" type="month" class="input sm:w-44" aria-label="เดือน">
    </div>

    <LoadingBlock v-if="loading" />
    <div v-else-if="!filtered.length" class="card"><EmptyState icon="💰" text="ไม่มีคำขอ OT" /></div>
    <template v-else>
      <p class="mb-2 text-sm text-slate-500">{{ filtered.length }} รายการ · {{ fmtNumber(totalHours) }} ชม. · {{ fmtMoney(totalAmount) }}<span v-if="!status"> (ไม่รวมที่ไม่อนุมัติ)</span></p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>พนักงาน</th><th>วันที่</th><th>เวลา</th><th>ชั่วโมง</th><th>เหตุผล</th><th>ยอดเงิน</th><th>สถานะ</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="r in filtered" :key="r.id">
              <td class="whitespace-nowrap">
                <p class="font-medium text-slate-800">{{ r.user_name }}</p>
                <p class="text-xs text-slate-400">{{ r.emp_code }}<span v-if="r.department"> · {{ r.department }}</span></p>
              </td>
              <td class="whitespace-nowrap">{{ fmtDate(r.date) }}</td>
              <td class="whitespace-nowrap">{{ r.start_time }} - {{ r.end_time }}</td>
              <td>{{ fmtNumber(r.hours) }}</td>
              <td class="min-w-[12rem]">{{ r.reason }}</td>
              <td class="whitespace-nowrap">
                <template v-if="r.status === 'rejected'">-</template>
                <template v-else>{{ fmtMoney(r.estimated_amount) }}<span v-if="r.status === 'pending'" class="ml-1 text-xs text-slate-400">(ประมาณ)</span></template>
              </td>
              <td>
                <StatusBadge :status="r.status" />
                <p v-if="r.reject_reason" class="mt-1 min-w-[10rem] text-xs text-rose-600">เหตุผล: {{ r.reject_reason }}</p>
              </td>
              <td>
                <div v-if="r.status === 'pending'" class="flex gap-2">
                  <button class="btn-primary btn-sm whitespace-nowrap" @click="ask(r, approveOpen)">อนุมัติ</button>
                  <button class="btn-danger btn-sm whitespace-nowrap" @click="ask(r, rejectOpen)">ไม่อนุมัติ</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <ConfirmModal v-model="approveOpen" title="อนุมัติ OT" :message="approveMessage" confirm-text="อนุมัติ" :loading="busy" @confirm="approve" />
    <ReasonModal v-model="rejectOpen" title="ไม่อนุมัติ OT" confirm-text="ไม่อนุมัติ" :loading="busy" @confirm="reject" />
  </div>
</template>
