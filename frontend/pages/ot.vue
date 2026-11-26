<script setup>
import { STATUS } from '~/utils/constants'
import { fmtDate, fmtMoney, fmtNumber, todayStr, apiError, dayjs } from '~/utils/format'

const MONTHLY_CAP = 36 // hours
const api = useApi()
const toast = useToast()
const auth = useAuthStore()

const loading = ref(true)
const rows = ref([])
const summary = ref({ hours: 0, amount: 0, pending: 0, year_hours: 0, year_amount: 0 })

async function load() {
  try {
    const [list, sum] = await Promise.all([api.get('/ot/me'), api.get('/ot/me/summary', { params: { month: dayjs().format('YYYY-MM') } })])
    rows.value = list.data
    summary.value = sum.data
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    loading.value = false
  }
}
onMounted(load)

const formOpen = ref(false)
const saving = ref(false)
const form = reactive({ date: '', start_time: '', end_time: '', reason: '' })
const hours = computed(() => {
  if (!form.start_time || !form.end_time) return 0
  const min = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  return Math.max(0, Math.round(((min(form.end_time) - min(form.start_time)) / 60) * 100) / 100)
})
const valid = computed(() => form.date && hours.value > 0 && form.reason.trim())

function openForm() {
  Object.assign(form, { date: todayStr(), start_time: '18:00', end_time: '20:00', reason: '' })
  formOpen.value = true
}
async function submit() {
  if (!valid.value || saving.value) return
  saving.value = true
  try {
    await api.post('/ot', { ...form })
    toast.success('ส่งคำขอ OT แล้ว')
    formOpen.value = false
    await load()
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    saving.value = false
  }
}

const cancelOpen = ref(false)
const cancelling = ref(false)
const target = ref(null)
function askCancel(row) {
  target.value = row
  cancelOpen.value = true
}
async function cancel() {
  cancelling.value = true
  try {
    await api.post(`/ot/${target.value.id}/cancel`)
    toast.success('ยกเลิกคำขอแล้ว')
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    cancelOpen.value = false
    cancelling.value = false
    await load()
  }
}

const columns = [
  { key: 'date', label: 'วันที่', filter: 'date', text: (r) => fmtDate(r.date), class: 'whitespace-nowrap' },
  { key: 'time', label: 'เวลา', value: (r) => `${r.start_time} - ${r.end_time}`, class: 'whitespace-nowrap' },
  { key: 'hours', label: 'ชั่วโมง', text: (r) => fmtNumber(r.hours) },
  { key: 'reason', label: 'เหตุผล', class: 'min-w-[12rem] break-words' },
  { key: 'status', label: 'สถานะ', filter: 'select', text: (r) => STATUS[r.status]?.label || r.status },
  { key: 'amount', label: 'เงิน OT', value: (r) => (r.status === 'approved' ? r.amount : null), text: (r) => (r.status === 'approved' ? fmtMoney(r.amount) : '-'), class: 'whitespace-nowrap' },
]
</script>

<template>
  <div>
    <PageHeader title="ขอทำ OT">
      <button v-if="auth.can('ot.request')" class="btn-primary" @click="openForm">+ ขอ OT</button>
    </PageHeader>

    <LoadingBlock v-if="loading" />
    <template v-else>
      <div class="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ชั่วโมง OT เดือนนี้" :value="`${fmtNumber(summary.hours)} ชม.`" hint="อนุมัติแล้ว" icon="🌙" tone="violet" />
        <StatCard label="เงิน OT เดือนนี้" :value="fmtMoney(summary.amount)" icon="💰" />
        <StatCard label="คำขอรออนุมัติ" :value="`${summary.pending} รายการ`" icon="⏳" tone="amber" />
        <StatCard label="OT รวมปีนี้" :value="fmtMoney(summary.year_amount)" :hint="`${fmtNumber(summary.year_hours)} ชม.`" icon="📅" tone="sky" />
      </div>

      <div class="card mb-4">
        <ProgressBar :value="Math.round(summary.hours * 100) / 100" :max="MONTHLY_CAP" label="ชั่วโมง OT เดือนนี้เทียบเพดาน" suffix=" ชม." :color="summary.hours >= MONTHLY_CAP ? 'rose' : 'violet'" />
      </div>

      <DataTable :columns="columns" :rows="rows" empty-text="ยังไม่มีคำขอ OT">
        <template #cell-status="{ row }">
          <StatusBadge :status="row.status" />
          <p v-if="row.status === 'rejected' && row.reject_reason" class="mt-1 min-w-[10rem] text-xs text-rose-600">เหตุผล: {{ row.reject_reason }}</p>
        </template>
        <template #actions="{ row }">
          <button v-if="row.status === 'pending'" class="btn-secondary btn-sm whitespace-nowrap" @click="askCancel(row)">ยกเลิก</button>
        </template>
      </DataTable>
    </template>

    <AppModal v-model="formOpen" title="ขอทำ OT">
      <form id="ot-form" class="space-y-3" @submit.prevent="submit">
        <div>
          <label class="label">วันที่</label>
          <input v-model="form.date" type="date" class="input" required>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">เวลาเริ่ม</label><input v-model="form.start_time" type="time" class="input" required></div>
          <div><label class="label">เวลาสิ้นสุด</label><input v-model="form.end_time" type="time" class="input" required></div>
        </div>
        <p v-if="hours > 0" class="text-sm text-slate-600">รวม <b>{{ hours }}</b> ชั่วโมง</p>
        <p v-else class="text-sm text-rose-600">เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม</p>
        <div>
          <label class="label">เหตุผล</label>
          <textarea v-model="form.reason" rows="3" class="input" placeholder="งานที่ต้องทำ..." required />
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="formOpen = false">ปิด</button>
        <button type="submit" form="ot-form" class="btn-primary" :disabled="!valid || saving"><Spinner v-if="saving" class="h-4 w-4" />ส่งคำขอ</button>
      </template>
    </AppModal>

    <ConfirmModal v-model="cancelOpen" title="ยกเลิกคำขอ OT" :message="target ? `ยกเลิกคำขอ OT วันที่ ${fmtDate(target.date)} ${target.start_time} - ${target.end_time}? รายการจะถูกลบ` : ''" confirm-text="ยกเลิกคำขอ" danger :loading="cancelling" @confirm="cancel" />
  </div>
</template>
