<script setup>
import BarChart from '~/components/charts/BarChart.vue'
import LineChart from '~/components/charts/LineChart.vue'
import DoughnutChart from '~/components/charts/DoughnutChart.vue'
import { CHECKIN_MODES } from '~/utils/constants'

definePageMeta({ roles: ['executive'] })

const api = useApi()
const toast = useToast()

const { lateLevel } = useAppSettings()
const LATE_TEXT = { yellow: 'font-semibold text-amber-700', red: 'font-semibold text-rose-600' }
const lateCls = (m) => LATE_TEXT[lateLevel(m)] || ''

const currentYear = Number(todayStr().slice(0, 4))
const year = ref(currentYear)
const years = ref([currentYear])
const stats = ref(null)
const loading = ref(true)

let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const { data } = await api.get('/stats/overview', { params: { year: year.value } })
    if (mine !== seq) return
    stats.value = data
    years.value = data.years.includes(year.value) ? data.years : [year.value, ...data.years]
  } catch (e) {
    if (mine !== seq) return
    stats.value = null
    toast.error(apiError(e))
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch(year, load)

const exporting = ref(false)
async function exportExcel() {
  exporting.value = true
  const y = year.value
  try {
    const { data } = await api.get('/stats/overview', { params: { year: y, format: 'xlsx' }, responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = `overview_${y}.xlsx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('ดาวน์โหลด Excel แล้ว')
  } catch (e) {
    // with responseType 'blob' the server's Thai error message arrives as a Blob
    let message = apiError(e)
    try { message = JSON.parse(await e.response.data.text()).error || message } catch {}
    toast.error(message)
  } finally {
    exporting.value = false
  }
}
onMounted(load)

const labels = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// computed rows keep a stable reference, so DataTable only resets its page when the data changes
const monthRows = computed(() => (stats.value?.months || []).map((m, i) => ({ ...m, label: labels[i] })))
const lateRows = computed(() => (stats.value?.top_late || []).map((u, i) => ({ ...u, rank: i + 1 })))

// value = what sorting uses; text = what the user sees (the text filter matches either)
const col = (key, label, value, text, extra) => ({ key, label, value, text: text && ((r) => text(value(r))), ...extra })
const money = (key, label, field) => col(key, label, (r) => r.payroll[field], fmtMoney, { align: 'right' })
const monthColumns = [
  { key: 'month', label: 'เดือน', filter: 'select', text: (r) => r.label },
  col('working_days', 'วัน\nทำงาน', (r) => r.working_days),
  col('checkins', 'เช็คอิน', (r) => r.checkins, fmtNumber),
  { key: 'late', label: 'มาสาย\n/ เวลาสาย', value: (r) => r.late_count, text: (r) => `${fmtNumber(r.late_count)} ครั้ง ${fmtMinutes(r.late_minutes)}` },
  { key: 'wfh', label: 'WFH\nอนุมัติ/ไม่', value: (r) => r.wfh_approved, text: (r) => `${r.wfh_approved} / ${r.wfh_rejected}` },
  { key: 'warnings', label: 'ใบเตือน\nออก/ยกเลิก', value: (r) => r.warnings_issued, text: (r) => `${r.warnings_issued} / ${r.warnings_cancelled}` },
  money('base', 'ฐาน\nเงินเดือน', 'base'),
  money('ot', 'OT', 'ot'),
  money('deduction', 'หัก', 'deduction'),
  money('total', 'สุทธิ', 'total'),
]
const lateColumns = [
  { key: 'rank', label: '#' },
  { key: 'emp_code', label: 'รหัส' },
  { key: 'name', label: 'ชื่อ', class: 'whitespace-nowrap' },
  { key: 'department', label: 'แผนก', filter: 'select', value: (r) => r.department || '-' },
  { key: 'late_count', label: 'จำนวนครั้ง' },
  { key: 'late_minutes', label: 'เวลาสายรวม', text: (r) => fmtMinutes(r.late_minutes), class: 'whitespace-nowrap' },
]
const yearTotals = computed(() => {
  const t = stats.value.totals
  return [
    ['วันทำงาน', t.working_days],
    ['เช็คอิน', fmtNumber(t.checkins)],
    ['มาสาย / เวลาสาย', `${fmtNumber(t.late_count)} ครั้ง · ${fmtMinutes(t.late_minutes)}`],
    ['WFH อนุมัติ/ไม่', `${t.wfh_approved} / ${t.wfh_rejected}`],
    ['ใบเตือน ออก/ยกเลิก', `${t.warnings_issued} / ${t.warnings_cancelled}`],
    ['ฐานเงินเดือน', fmtMoney(t.payroll.base)],
    ['OT', fmtMoney(t.payroll.ot)],
    ['หัก', fmtMoney(t.payroll.deduction)],
    ['สุทธิ', fmtMoney(t.payroll.total)],
  ]
})
const series = (fn) => stats.value.months.map(fn)

// "payroll this month" = the current month in the current year, December for a past year
const focusIndex = computed(() => (stats.value?.year === currentYear ? Number(todayStr().slice(5, 7)) - 1 : 11))
const focus = computed(() => stats.value.months[focusIndex.value])

const payrollSets = computed(() => [{ label: 'เงินเดือนสุทธิ (บาท)', data: series((m) => m.payroll.total), backgroundColor: '#2a78d6', borderRadius: 4 }])
const attendanceSets = computed(() => [
  { label: 'เช็คอิน (ครั้ง)', data: series((m) => m.checkins), borderColor: '#2a78d6', backgroundColor: '#2a78d6', borderWidth: 2, tension: 0.3 },
  { label: 'มาสาย (ครั้ง)', data: series((m) => m.late_count), borderColor: '#eb6834', backgroundColor: '#eb6834', borderWidth: 2, tension: 0.3 },
])
const modeLabels = Object.values(CHECKIN_MODES).map((m) => m.label)
const modeValues = computed(() => Object.keys(CHECKIN_MODES).map((k) => stats.value.totals[k]))
const deptLabels = computed(() => stats.value.departments.map((d) => d.department))
const deptSets = computed(() => [{ label: 'เงินเดือนทั้งปี (บาท)', data: stats.value.departments.map((d) => d.payroll), backgroundColor: '#1baf7a', borderRadius: 4 }])
</script>

<template>
  <div>
    <PageHeader title="ภาพรวม & สถิติ" subtitle="สรุปการเข้างาน มาสาย ใบเตือน วันทำงาน และเงินเดือน">
      <label class="flex items-center gap-2 text-sm text-slate-600">
        ปี
        <select v-model.number="year" class="input w-32">
          <option v-for="y in years" :key="y" :value="y">{{ y + 543 }}</option>
        </select>
      </label>
      <button class="btn-primary" :disabled="exporting || loading || !stats" @click="exportExcel"><Spinner v-if="exporting" class="h-4 w-4" />📊 Export Excel</button>
    </PageHeader>

    <LoadingBlock v-if="loading" />
    <div v-else-if="!stats" class="card">
      <EmptyState icon="⚠️" text="โหลดข้อมูลไม่สำเร็จ" />
      <div class="flex justify-center"><button class="btn-secondary" @click="load">ลองอีกครั้ง</button></div>
    </div>

    <div v-else class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon="👥" label="พนักงานปัจจุบัน" :value="`${fmtNumber(stats.headcount)} คน`" />
        <StatCard icon="✅" tone="sky" label="อัตราการเข้างาน" :value="`${stats.totals.attendance_rate}%`" :hint="`เช็คอิน ${fmtNumber(stats.totals.checkins)} ครั้ง`" />
        <StatCard icon="⏰" tone="amber" label="มาสายรวม" :value="`${fmtNumber(stats.totals.late_count)} ครั้ง`" :hint="fmtMinutes(stats.totals.late_minutes)" :class="lateLevel(stats.totals.late_minutes) === 'red' ? '[&_p:last-child]:!text-rose-600' : lateLevel(stats.totals.late_minutes) === 'yellow' ? '[&_p:last-child]:!text-amber-700' : ''" />
        <StatCard icon="⚠️" tone="rose" label="ใบเตือนที่ออก" :value="`${fmtNumber(stats.totals.warnings_issued)} ใบ`" :hint="`ยกเลิก ${fmtNumber(stats.totals.warnings_cancelled)} ใบ`" />
        <StatCard icon="💰" tone="violet" :label="`เงินเดือนเดือน ${labels[focusIndex]}`" :value="fmtMoney(focus.payroll.total)" :hint="`OT ${fmtMoney(focus.payroll.ot)} · หัก ${fmtMoney(focus.payroll.deduction)}`" />
        <StatCard icon="📈" tone="slate" label="เงินเดือนสะสมทั้งปี" :value="fmtMoney(stats.totals.payroll.total)" :hint="`OT ${fmtMoney(stats.totals.payroll.ot)} · หัก ${fmtMoney(stats.totals.payroll.deduction)}`" />
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="card min-w-0">
          <h2 class="mb-3 font-semibold text-slate-800">เงินเดือนรายเดือน</h2>
          <BarChart :labels="labels" :datasets="payrollSets" />
        </div>
        <div class="card min-w-0">
          <h2 class="mb-3 font-semibold text-slate-800">การเข้างานและมาสายรายเดือน</h2>
          <LineChart :labels="labels" :datasets="attendanceSets" />
        </div>
        <div class="card min-w-0">
          <h2 class="mb-3 font-semibold text-slate-800">รูปแบบการเข้างาน</h2>
          <DoughnutChart v-if="stats.totals.checkins" :labels="modeLabels" :values="modeValues" :colors="['#2a78d6', '#eb6834', '#1baf7a']" />
          <EmptyState v-else />
        </div>
        <div class="card min-w-0">
          <h2 class="mb-3 font-semibold text-slate-800">เงินเดือนทั้งปีแยกตามแผนก</h2>
          <BarChart v-if="deptLabels.length" :labels="deptLabels" :datasets="deptSets" />
          <EmptyState v-else />
        </div>
      </div>

      <div class="card min-w-0">
        <h2 class="mb-3 font-semibold text-slate-800">สรุปรายเดือน</h2>
        <!-- compact so all columns fit ~916px (1280 with sidebar); narrower screens scroll inside .table-wrap -->
        <DataTable
          class="[&_.table]:whitespace-nowrap [&_.table]:!text-xs [&_.table_td]:!px-1.5 [&_.table_th]:!px-1.5 [&_thead_span]:whitespace-pre-line [&_thead_.input]:min-w-[3.5rem] [&_thead_.input]:!px-1"
          :columns="monthColumns" :rows="monthRows" row-key="month"
        >
          <template #cell-late="{ row }">
            {{ fmtNumber(row.late_count) }} ครั้ง<div class="text-[11px]" :class="lateCls(row.late_minutes) || 'text-slate-400'">{{ fmtMinutes(row.late_minutes) }}</div>
          </template>
          <template #cell-total="{ value }"><span class="font-medium">{{ fmtMoney(value) }}</span></template>
        </DataTable>
        <div class="mt-3 rounded-xl bg-slate-50 p-3">
          <h3 class="mb-2 text-sm font-semibold text-slate-800">รวมทั้งปี</h3>
          <dl class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
            <div v-for="[label, value] in yearTotals" :key="label">
              <dt class="text-slate-500">{{ label }}</dt>
              <dd class="font-semibold" :class="(label === 'มาสาย / เวลาสาย' && lateCls(stats.totals.late_minutes)) || 'text-slate-800'">{{ value }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div class="card min-w-0">
        <h2 class="mb-3 font-semibold text-slate-800">พนักงานมาสายสูงสุด</h2>
        <DataTable v-if="lateRows.length" :columns="lateColumns" :rows="lateRows" row-key="user_id">
          <template #cell-late_minutes="{ row }"><LateBadge :minutes="row.late_minutes" prefix="" /></template>
        </DataTable>
        <EmptyState v-else icon="🎉" text="ไม่มีพนักงานมาสายในปีนี้" />
      </div>
    </div>
  </div>
</template>
