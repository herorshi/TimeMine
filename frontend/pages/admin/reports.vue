<script setup>
import { fmtDate, fmtMoney, fmtNumber, fmtMinutes, apiError, dayjs, todayStr } from '~/utils/format'
import { STATUS } from '~/utils/constants'

definePageMeta({ roles: ['admin'] })
const api = useApi()
const toast = useToast()

const TABS = { attendance: 'การเข้างาน', leaves: 'การลา', ot: 'OT', payroll: 'เงินเดือน' }
const CARDS = {
  attendance: [['employees', 'พนักงาน', '👥'], ['days', 'วันเข้างานรวม', '🗂️'], ['wfh', 'WFH (วัน)', '🏠'], ['late_count', 'มาสาย (ครั้ง)', '⏰'], ['late_minutes', 'เวลาสายรวม', '⌛', fmtMinutes]],
  leaves: [['requests', 'คำขอลา', '📋'], ['approved', 'อนุมัติแล้ว', '✅'], ['approved_days', 'วันลาที่อนุมัติ', '🌴'], ['pending', 'รออนุมัติ', '⏳']],
  ot: [['requests', 'คำขอ OT', '🌙'], ['approved_hours', 'ชั่วโมงที่อนุมัติ', '⌛'], ['approved_amount', 'ค่า OT ที่อนุมัติ', '💰', fmtMoney], ['pending', 'รออนุมัติ', '⏳']],
  payroll: [['employees', 'พนักงาน', '👥'], ['base', 'เงินเดือนรวม', '🏦', fmtMoney], ['ot', 'ค่า OT รวม', '🌙', fmtMoney], ['deduction', 'ยอดหักรวม', '➖', fmtMoney], ['total', 'จ่ายสุทธิ', '💰', fmtMoney]],
}
const MONEY = ['amount', 'base', 'ot', 'deduction', 'total']
const DATES = ['date', 'start_date', 'end_date']
const SELECTS = ['department', 'type_label', 'status_label']

const { lateLevel } = useAppSettings()
const LATE_CARD = { yellow: '[&_.stat-value]:!text-amber-700', red: '[&_.stat-value]:!text-rose-600' }
const lateCls = (m) => LATE_CARD[lateLevel(m)] || ''

const tab = ref('attendance')
const month = ref(todayStr().slice(0, 7))
const from = ref(dayjs().startOf('month').format('YYYY-MM-DD'))
const to = ref(todayStr())
const report = ref(null)
const loading = ref(false)
const downloading = ref('') // '' | 'csv' | 'xlsx'

const valid = computed(() => (tab.value === 'payroll' ? !!month.value : !!from.value && !!to.value && from.value <= to.value))
const params = computed(() => (tab.value === 'payroll' ? { month: month.value } : { from: from.value, to: to.value }))

let seq = 0
async function load() {
  const mine = ++seq
  report.value = null
  if (!valid.value) { loading.value = false; return }
  loading.value = true
  try {
    const { data } = await api.get(`/reports/${tab.value}`, { params: params.value })
    if (mine === seq) report.value = { ...data, tab: tab.value }
  } catch (e) { if (mine === seq) toast.error(apiError(e)) }
  finally { if (mine === seq) loading.value = false }
}
watch([tab, params], load, { immediate: true })

/** month shortcut for the date-range tabs */
function pickMonth(v) {
  if (!v) return
  from.value = `${v}-01`
  to.value = dayjs(`${v}-01`).endOf('month').format('YYYY-MM-DD')
}
const rangeMonth = computed(() => {
  const m = from.value.slice(0, 7)
  return from.value === `${m}-01` && to.value === dayjs(from.value).endOf('month').format('YYYY-MM-DD') ? m : ''
})

const cell = (key, v) => {
  if (MONEY.includes(key)) return fmtMoney(v)
  if (DATES.includes(key)) return fmtDate(v)
  if (typeof v === 'number') return fmtNumber(v)
  return v || '-'
}

// the server sends [[key, label]]; filters match the text shown in the cell
const columns = computed(() => (report.value?.columns || []).map(([key, label]) => {
  const col = {
    key,
    label,
    filter: SELECTS.includes(key) ? 'select' : DATES.includes(key) ? 'date' : 'text',
    text: (r) => (key === 'late_minutes' ? fmtMinutes(r[key]) : cell(key, r[key])),
    class: key === 'reason' ? 'min-w-[14rem] break-words' : 'whitespace-nowrap',
  }
  if (key === 'status_label') {
    col.value = (r) => r.status
    col.text = (r) => STATUS[r.status]?.label || r.status
  }
  return col
}))

async function download(format) {
  downloading.value = format
  const name = `${tab.value}_${Object.values(params.value).join('_')}.${format}`
  try {
    const { data } = await api.get(`/reports/${tab.value}`, { params: { ...params.value, format }, responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success(`ดาวน์โหลด ${format === 'csv' ? 'CSV' : 'Excel'} แล้ว`)
  } catch (e) { toast.error(await blobError(e)) }
  finally { downloading.value = '' }
}
/** with responseType 'blob' the server's Thai error message arrives as a Blob */
async function blobError(e) {
  try { return JSON.parse(await e.response.data.text()).error || apiError(e) } catch { return apiError(e) }
}
</script>

<template>
  <div>
    <PageHeader title="รายงาน" subtitle="ดูข้อมูลปัจจุบันและย้อนหลัง">
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" :disabled="!!downloading || loading || !report" @click="download('csv')"><Spinner v-if="downloading === 'csv'" class="h-4 w-4" />⬇ ดาวน์โหลด CSV</button>
        <button class="btn-primary" :disabled="!!downloading || loading || !report" @click="download('xlsx')"><Spinner v-if="downloading === 'xlsx'" class="h-4 w-4" />📊 Export Excel</button>
      </div>
    </PageHeader>

    <div class="mb-4 flex flex-wrap gap-2">
      <button v-for="(label, key) in TABS" :key="key" class="btn-sm" :class="tab === key ? 'btn-primary' : 'btn-secondary'" @click="tab = key">{{ label }}</button>
    </div>

    <div class="card mb-4 grid gap-3 sm:grid-cols-3">
      <div v-if="tab === 'payroll'">
        <label class="label">เดือน</label>
        <DateInput v-model="month" type="month" clearable />
      </div>
      <template v-else>
        <div>
          <label class="label">เลือกทั้งเดือน</label>
          <DateInput :model-value="rangeMonth" type="month" @update:model-value="pickMonth" />
        </div>
        <div><label class="label">ตั้งแต่วันที่</label><DateInput v-model="from" clearable /></div>
        <div><label class="label">ถึงวันที่</label><DateInput v-model="to" clearable /></div>
      </template>
    </div>

    <p v-if="!valid" class="card text-sm text-rose-600">กรุณาเลือกช่วงเวลาให้ถูกต้อง</p>
    <LoadingBlock v-else-if="loading" />
    <template v-else-if="report">
      <div class="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard v-for="[key, label, icon, fmt] in CARDS[report.tab]" :key="key" :label="label" :icon="icon" :value="(fmt || fmtNumber)(report.summary[key])" :class="key === 'late_minutes' ? lateCls(report.summary[key]) : ''" />
      </div>
      <p v-if="report.tab === 'payroll'" class="mb-3 text-xs text-slate-500">ยอดย้อนหลังคำนวณจากเงินเดือนและการตั้งค่าปัจจุบัน</p>
      <DataTable :key="report.tab" :columns="columns" :rows="report.rows" empty-text="ไม่มีข้อมูลในช่วงเวลานี้">
        <template #cell-late_minutes="{ row }"><LateBadge :minutes="Number(row.late_minutes || 0)" prefix="" /></template>
        <template #cell-status_label="{ row }"><StatusBadge :status="row.status" /></template>
      </DataTable>
    </template>
  </div>
</template>
