<script setup>
import BarChart from '~/components/charts/BarChart.vue'
import LineChart from '~/components/charts/LineChart.vue'
import DoughnutChart from '~/components/charts/DoughnutChart.vue'
import { CHECKIN_MODES } from '~/utils/constants'

definePageMeta({ roles: ['executive'] })

const api = useApi()
const toast = useToast()

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
onMounted(load)

const labels = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
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
        <StatCard icon="⏰" tone="amber" label="มาสายรวม" :value="`${fmtNumber(stats.totals.late_count)} ครั้ง`" :hint="fmtMinutes(stats.totals.late_minutes)" />
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

      <div class="card">
        <h2 class="mb-3 font-semibold text-slate-800">สรุปรายเดือน</h2>
        <div class="table-wrap">
          <table class="table whitespace-nowrap">
            <thead>
              <tr>
                <th>เดือน</th><th>วันทำงาน</th><th>เช็คอิน</th><th>มาสาย</th><th>เวลาสาย</th><th>WFH อนุมัติ / ไม่อนุมัติ</th>
                <th>ใบเตือน ออก / ยกเลิก</th><th>ฐานเงินเดือน</th><th>OT</th><th>หัก</th><th>สุทธิ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in stats.months" :key="m.month">
                <td>{{ labels[i] }}</td><td>{{ m.working_days }}</td><td>{{ fmtNumber(m.checkins) }}</td><td>{{ fmtNumber(m.late_count) }}</td>
                <td>{{ fmtMinutes(m.late_minutes) }}</td><td>{{ m.wfh_approved }} / {{ m.wfh_rejected }}</td>
                <td>{{ m.warnings_issued }} / {{ m.warnings_cancelled }}</td><td>{{ fmtMoney(m.payroll.base) }}</td>
                <td>{{ fmtMoney(m.payroll.ot) }}</td><td>{{ fmtMoney(m.payroll.deduction) }}</td><td class="font-medium">{{ fmtMoney(m.payroll.total) }}</td>
              </tr>
              <tr class="font-semibold">
                <td>รวม</td><td>{{ stats.totals.working_days }}</td><td>{{ fmtNumber(stats.totals.checkins) }}</td><td>{{ fmtNumber(stats.totals.late_count) }}</td>
                <td>{{ fmtMinutes(stats.totals.late_minutes) }}</td><td>{{ stats.totals.wfh_approved }} / {{ stats.totals.wfh_rejected }}</td>
                <td>{{ stats.totals.warnings_issued }} / {{ stats.totals.warnings_cancelled }}</td><td>{{ fmtMoney(stats.totals.payroll.base) }}</td>
                <td>{{ fmtMoney(stats.totals.payroll.ot) }}</td><td>{{ fmtMoney(stats.totals.payroll.deduction) }}</td><td>{{ fmtMoney(stats.totals.payroll.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2 class="mb-3 font-semibold text-slate-800">พนักงานมาสายสูงสุด</h2>
        <div v-if="stats.top_late.length" class="table-wrap">
          <table class="table">
            <thead><tr><th>#</th><th>รหัส</th><th>ชื่อ</th><th>แผนก</th><th>จำนวนครั้ง</th><th>เวลาสายรวม</th></tr></thead>
            <tbody>
              <tr v-for="(u, i) in stats.top_late" :key="u.user_id">
                <td>{{ i + 1 }}</td><td>{{ u.emp_code }}</td><td class="whitespace-nowrap">{{ u.name }}</td><td>{{ u.department || '-' }}</td>
                <td>{{ u.late_count }}</td><td class="whitespace-nowrap">{{ fmtMinutes(u.late_minutes) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-else icon="🎉" text="ไม่มีพนักงานมาสายในปีนี้" />
      </div>
    </div>
  </div>
</template>
