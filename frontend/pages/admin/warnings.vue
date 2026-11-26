<script setup>
import { WARNING_LEVELS, WARNING_CATEGORIES } from '~/utils/constants'
import { fmtDateTime, apiError } from '~/utils/format'

definePageMeta({ roles: ['admin'] })
const api = useApi()
const toast = useToast()

const loading = ref(true)
const all = ref([])
const users = ref([])
const filter = reactive({ user_id: '', status: '', level: '' })

// filtered on the client so the per-employee counts always cover every warning
const items = computed(() => all.value.filter((w) =>
  (!filter.user_id || w.user_id === filter.user_id) &&
  (!filter.status || w.status === filter.status) &&
  (!filter.level || w.level === filter.level)))
const activeCounts = computed(() => {
  const m = new Map()
  for (const w of all.value) {
    if (w.status !== 'active') continue
    const c = m.get(w.user_id) || { user_id: w.user_id, name: w.user_name, emp_code: w.emp_code, count: 0 }
    c.count++
    m.set(w.user_id, c)
  }
  return [...m.values()].sort((a, b) => b.count - a.count)
})
const countOf = (id) => activeCounts.value.find((c) => c.user_id === id)?.count || 0

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))
// value/text mirror what each cell shows, so the column filters and sorting match the screen
const columns = [
  { key: 'issued_at', label: 'วันที่ออก', filter: 'date', text: (w) => fmtDateTime(w.issued_at), class: 'whitespace-nowrap' },
  { key: 'user_name', label: 'พนักงาน', text: (w) => `${w.user_name} ${w.emp_code}`, class: 'whitespace-nowrap' },
  { key: 'level', label: 'ระดับ', filter: 'select', options: toOptions(WARNING_LEVELS), text: (w) => WARNING_LEVELS[w.level] || w.level, class: 'whitespace-nowrap' },
  { key: 'category', label: 'หมวดหมู่', filter: 'select', options: toOptions(WARNING_CATEGORIES), text: (w) => WARNING_CATEGORIES[w.category] || w.category, class: 'whitespace-nowrap' },
  { key: 'reason', label: 'เหตุผล', text: (w) => (w.status === 'cancelled' ? `${w.reason} ยกเลิก: ${w.cancel_reason} (${w.cancelled_by_name || '-'}, ${fmtDateTime(w.cancelled_at)})` : w.reason), class: 'min-w-[16rem] break-words' },
  { key: 'status', label: 'สถานะ', filter: 'select', options: [{ value: 'active', label: 'มีผล' }, { value: 'cancelled', label: 'ยกเลิก' }] },
]

async function load() {
  try { all.value = (await api.get('/warnings')).data }
  catch (e) { toast.error(apiError(e)) }
  finally { loading.value = false }
}
async function loadUsers() {
  try {
    const { data } = await api.get('/users')
    users.value = (Array.isArray(data) ? data : data.users || []).filter((u) => u.active !== false && u.active !== 0)
  } catch (e) { toast.error(apiError(e)) }
}
onMounted(() => { load(); loadUsers() })

const formOpen = ref(false)
const saving = ref(false)
const form = reactive({ user_id: '', level: 'verbal', category: 'late', reason: '' })
function openForm() {
  Object.assign(form, { user_id: '', level: 'verbal', category: 'late', reason: '' })
  formOpen.value = true
}
async function issue() {
  saving.value = true
  try {
    await api.post('/warnings', { ...form, reason: form.reason.trim() })
    toast.success('ออกใบเตือนแล้ว')
    formOpen.value = false
    await load()
  } catch (e) { toast.error(apiError(e)) }
  finally { saving.value = false }
}

const cancelOpen = ref(false)
const cancelTarget = ref(null)
const cancelling = ref(false)
function askCancel(w) { cancelTarget.value = w; cancelOpen.value = true }
async function doCancel(reason) {
  cancelling.value = true
  try {
    await api.post(`/warnings/${cancelTarget.value.id}/cancel`, { reason })
    toast.success('ยกเลิกใบเตือนแล้ว')
    cancelOpen.value = false
    await load()
  } catch (e) { toast.error(apiError(e)) }
  finally { cancelling.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="ใบเตือน" subtitle="ออก ยกเลิก และติดตามใบเตือนพนักงาน">
      <button class="btn-primary" @click="openForm">+ ออกใบเตือน</button>
    </PageHeader>

    <div v-if="activeCounts.length" class="card mb-4">
      <p class="mb-3 text-sm font-semibold text-slate-700">ใบเตือนที่มีผลรายพนักงาน (กดเพื่อกรอง)</p>
      <div class="flex flex-wrap gap-2">
        <button v-for="c in activeCounts" :key="c.user_id" class="btn-sm btn border" :class="filter.user_id === c.user_id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'" @click="filter.user_id = filter.user_id === c.user_id ? '' : c.user_id">
          {{ c.name }} ({{ c.emp_code }}) <span class="rounded-full bg-rose-100 px-2 text-rose-700">{{ c.count }}</span>
        </button>
      </div>
    </div>

    <div class="card mb-4 grid gap-3 sm:grid-cols-3">
      <div>
        <label class="label">พนักงาน</label>
        <select v-model="filter.user_id" class="input">
          <option value="">ทั้งหมด</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.emp_code }})</option>
        </select>
      </div>
      <div>
        <label class="label">ระดับ</label>
        <select v-model="filter.level" class="input">
          <option value="">ทั้งหมด</option>
          <option v-for="(label, key) in WARNING_LEVELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <div>
        <label class="label">สถานะ</label>
        <select v-model="filter.status" class="input">
          <option value="">ทั้งหมด</option>
          <option value="active">มีผล</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
      </div>
    </div>

    <DataTable :columns="columns" :rows="items" row-key="id" :loading="loading" empty-text="ไม่พบใบเตือน">
      <template #cell-issued_at="{ row }">{{ fmtDateTime(row.issued_at) }}</template>
      <template #cell-user_name="{ row }">{{ row.user_name }}<p class="text-xs text-slate-400">{{ row.emp_code }} · มีผล {{ countOf(row.user_id) }} ใบ</p></template>
      <template #cell-reason="{ row }">
        <p class="whitespace-pre-wrap">{{ row.reason }}</p>
        <p v-if="row.status === 'cancelled'" class="mt-1 text-xs text-slate-400">ยกเลิก: {{ row.cancel_reason }} ({{ row.cancelled_by_name || '-' }}, {{ fmtDateTime(row.cancelled_at) }})</p>
      </template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #actions="{ row }"><button v-if="row.status === 'active'" class="btn-secondary btn-sm whitespace-nowrap" @click="askCancel(row)">ยกเลิกใบเตือน</button></template>
    </DataTable>

    <AppModal v-model="formOpen" title="ออกใบเตือน">
      <div class="space-y-3">
        <div>
          <label class="label">พนักงาน</label>
          <select v-model="form.user_id" class="input">
            <option value="" disabled>เลือกพนักงาน</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.emp_code }})</option>
          </select>
          <p v-if="form.user_id" class="mt-1 text-xs text-slate-500">ใบเตือนที่มีผลอยู่ {{ countOf(form.user_id) }} ใบ</p>
        </div>
        <div>
          <label class="label">ระดับ</label>
          <select v-model="form.level" class="input">
            <option v-for="(label, key) in WARNING_LEVELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="label">หมวดหมู่</label>
          <select v-model="form.category" class="input">
            <option v-for="(label, key) in WARNING_CATEGORIES" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="label">เหตุผล</label>
          <textarea v-model="form.reason" rows="4" class="input" placeholder="รายละเอียดเหตุผล..." />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="formOpen = false">ปิด</button>
        <button class="btn-primary" :disabled="saving || !form.user_id || !form.reason.trim()" @click="issue"><Spinner v-if="saving" class="h-4 w-4" />ออกใบเตือน</button>
      </template>
    </AppModal>

    <ReasonModal v-model="cancelOpen" title="ยกเลิกใบเตือน" label="เหตุผลที่ยกเลิก" confirm-text="ยืนยันยกเลิก" :loading="cancelling" @confirm="doCancel" />
  </div>
</template>
