<script setup>
import { LEAVE_TYPES, STATUS } from '~/utils/constants'
import { apiError, fmtDate, fmtDateTime, dayjs } from '~/utils/format'

const api = useApi()
const toast = useToast()
const auth = useAuthStore()

const thisYear = dayjs().year()
const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2]
const year = ref(thisYear)
const types = ref([])
const balance = ref([])
const leaves = ref([])
const loading = ref(true)

async function loadBalance() {
  balance.value = (await api.get('/leaves/me/balance', { params: { year: year.value } })).data
}
async function load() {
  try {
    const [t, l] = await Promise.all([api.get('/leaves/types'), api.get('/leaves/me'), loadBalance()])
    types.value = t.data
    leaves.value = l.data
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(year, () => loadBalance().catch((e) => toast.error(apiError(e))))

const showForm = ref(false)
const saving = ref(false)
const form = reactive({ type: '', start_date: '', end_date: '', reason: '' })

/** preview only, same rule as the server: skip Sat/Sun */
const days = computed(() => {
  if (!form.start_date || !form.end_date) return 0
  const end = dayjs(form.end_date)
  if (end.diff(form.start_date, 'day') > 366) return 0
  let n = 0
  for (let d = dayjs(form.start_date); !d.isAfter(end); d = d.add(1, 'day')) if (d.day() !== 0 && d.day() !== 6) n++
  return n
})
const canSubmit = computed(() => form.type && form.start_date && form.end_date && form.reason.trim() && days.value > 0)

function openForm() {
  Object.assign(form, { type: types.value[0]?.key || '', start_date: '', end_date: '', reason: '' })
  showForm.value = true
}
watch(() => form.start_date, (v) => { if (v && (!form.end_date || form.end_date < v)) form.end_date = v })

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  try {
    await api.post('/leaves', { ...form, reason: form.reason.trim() })
    toast.success('ส่งคำขอลาแล้ว')
    showForm.value = false
    await load()
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    saving.value = false
  }
}

const cancelTarget = ref(null)
const showCancel = ref(false)
const cancelling = ref(false)
function askCancel(row) {
  cancelTarget.value = row
  showCancel.value = true
}
async function doCancel() {
  cancelling.value = true
  try {
    await api.post(`/leaves/${cancelTarget.value.id}/cancel`)
    toast.success('ยกเลิกคำขอลาแล้ว')
    showCancel.value = false
    await load()
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    cancelling.value = false
  }
}
const range = (r) => (r.start_date === r.end_date ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} - ${fmtDate(r.end_date)}`)

const columns = [
  { key: 'type', label: 'ประเภท', filter: 'select', text: (r) => r.type_label, class: 'whitespace-nowrap' },
  // date filter and sort use the start date
  { key: 'start_date', label: 'วันที่ลา', filter: 'date', text: range, class: 'whitespace-nowrap' },
  { key: 'days', label: 'จำนวน', text: (r) => `${r.days} วัน`, class: 'whitespace-nowrap' },
  { key: 'reason', label: 'เหตุผล', text: (r) => r.reason || '-', class: 'min-w-[12rem] break-words' },
  { key: 'status', label: 'สถานะ', filter: 'select', text: (r) => STATUS[r.status]?.label || r.status, class: 'min-w-[10rem]' },
  { key: 'created_at', label: 'ส่งเมื่อ', filter: 'date', text: (r) => fmtDateTime(r.created_at), class: 'whitespace-nowrap text-slate-500' },
]
</script>

<template>
  <div>
    <PageHeader title="ลางาน" subtitle="โควตาวันลาและคำขอลาของฉัน">
      <select v-model.number="year" class="input !w-auto" aria-label="ปีของโควตา">
        <option v-for="y in years" :key="y" :value="y">ปี {{ y + 543 }}</option>
      </select>
      <button v-if="auth.can('leave.request')" class="btn-primary" :disabled="loading || !types.length" @click="openForm">+ ขอลา</button>
    </PageHeader>

    <LoadingBlock v-if="loading" />
    <template v-else>
      <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="b in balance" :key="b.type" class="card">
          <p class="mb-3 font-semibold text-slate-800">{{ LEAVE_TYPES[b.type]?.icon }} {{ b.label }}</p>
          <template v-if="b.quota !== null">
            <ProgressBar :value="b.used" :max="b.quota" label="ใช้ไป" suffix=" วัน" :color="b.used >= b.quota ? 'rose' : 'brand'" />
            <p class="mt-2 text-xs text-slate-500">คงเหลือ {{ Math.max(0, b.quota - b.used) }} วัน</p>
          </template>
          <p v-else class="text-sm text-slate-500">ใช้ไป {{ b.used }} วัน (ไม่จำกัดโควตา)</p>
        </div>
      </div>

      <DataTable :columns="columns" :rows="leaves" empty-text="ยังไม่มีคำขอลา">
        <template #cell-status="{ row }">
          <StatusBadge :status="row.status" />
          <p v-if="row.reject_reason" class="mt-1 break-words text-xs text-rose-600">เหตุผลที่ไม่อนุมัติ: {{ row.reject_reason }}</p>
        </template>
        <template #actions="{ row }">
          <button v-if="row.status === 'pending'" class="btn-secondary btn-sm whitespace-nowrap" @click="askCancel(row)">ยกเลิก</button>
        </template>
      </DataTable>
    </template>

    <AppModal v-model="showForm" title="ขอลางาน">
      <form id="leave-form" class="space-y-4" @submit.prevent="submit">
        <div>
          <label class="label">ประเภทการลา</label>
          <select v-model="form.type" class="input">
            <option v-for="t in types" :key="t.key" :value="t.key">{{ t.label }}</option>
          </select>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label">วันเริ่มลา</label>
            <input v-model="form.start_date" type="date" class="input" required>
          </div>
          <div>
            <label class="label">วันสิ้นสุด</label>
            <input v-model="form.end_date" type="date" class="input" :min="form.start_date" required>
          </div>
        </div>
        <p class="text-sm text-slate-600">จำนวนวันทำงาน: <b>{{ days }}</b> วัน</p>
        <div>
          <label class="label">เหตุผล</label>
          <textarea v-model="form.reason" rows="3" class="input" placeholder="พิมพ์เหตุผลการลา..." required />
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="showForm = false">ปิด</button>
        <button type="submit" form="leave-form" class="btn-primary" :disabled="!canSubmit || saving"><Spinner v-if="saving" class="h-4 w-4" />ส่งคำขอ</button>
      </template>
    </AppModal>

    <ConfirmModal
      v-model="showCancel" title="ยกเลิกคำขอลา" confirm-text="ยกเลิกคำขอ" danger :loading="cancelling"
      :message="cancelTarget ? `ต้องการยกเลิกคำขอ${cancelTarget.type_label} ${range(cancelTarget)} ใช่หรือไม่` : ''"
      @confirm="doCancel"
    />
  </div>
</template>
