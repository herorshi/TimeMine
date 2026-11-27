<script setup>
// Annual KPI dashboard — contract: docs/kpi.md (GET /kpi/ranking)
import BarChart from '~/components/charts/BarChart.vue'
import DoughnutChart from '~/components/charts/DoughnutChart.vue'

definePageMeta({ roles: ['executive'] })

const api = useApi()
const toast = useToast()

const currentYear = Number(todayStr().slice(0, 4))
const year = ref(currentYear)
const years = ref([currentYear])
const report = ref(null)
const loading = ref(true)

let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const { data } = await api.get('/kpi/ranking', { params: { year: year.value } })
    if (mine !== seq) return
    report.value = data
    years.value = [...new Set([year.value, ...(data.years || [])])].sort((a, b) => b - a)
  } catch (e) {
    if (mine !== seq) return
    report.value = null
    toast.error(apiError(e))
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch(year, load)
onMounted(load)

const GRADES = {
  A: { color: '#10b981', row: '!bg-emerald-50 shadow-[inset_0_0_0_1px_#a7f3d0]', badge: 'bg-emerald-100 text-emerald-700', bar: 'brand' },
  B: { color: '#0ea5e9', row: '!bg-sky-50', badge: 'bg-sky-100 text-sky-700', bar: 'sky' },
  C: { color: '#64748b', row: '!bg-slate-50', badge: 'bg-slate-200 text-slate-700', bar: 'slate' },
  D: { color: '#f59e0b', row: '!bg-amber-50', badge: 'bg-amber-100 text-amber-700', bar: 'amber' },
  F: { color: '#f43f5e', row: '!bg-rose-50', badge: 'bg-rose-100 text-rose-700', bar: 'rose' },
}
const MEDALS = [
  { icon: '🥇', label: 'อันดับ 1', card: 'order-1 border-amber-300 from-amber-100 via-yellow-50 to-amber-200 shadow-[0_0_28px_rgba(251,191,36,0.45)] sm:order-2 sm:pb-8 sm:pt-8' },
  { icon: '🥈', label: 'อันดับ 2', card: 'order-2 border-slate-300 from-slate-200 via-white to-slate-300 shadow-[0_0_22px_rgba(148,163,184,0.45)] sm:order-1' },
  { icon: '🥉', label: 'อันดับ 3', card: 'order-3 border-orange-300 from-orange-100 via-amber-50 to-orange-200 shadow-[0_0_22px_rgba(251,146,60,0.4)] sm:order-3' },
]

// the API returns rows already sorted by total desc; DataTable keeps that order until a header is clicked
const rows = computed(() => report.value?.rows || [])
const finals = computed(() => rows.value.filter((r) => r.status !== 'draft' && r.total_score !== null))
const podium = computed(() => finals.value.slice(0, 3).map((r, i) => ({ ...r, medal: MEDALS[i] })))

const score = (key, label) => ({ key, label, align: 'center', value: (r) => r[key], text: (r) => String(r[key] ?? '-') })
const columns = [
  { key: 'rank', label: '#', align: 'center' },
  { key: 'name', label: 'ชื่อ', value: (r) => r.user.name, class: 'whitespace-nowrap' },
  { key: 'department', label: 'แผนก', filter: 'select', value: (r) => r.user.department || '-' },
  score('attendance_score', 'เข้างาน'),
  score('quality', 'คุณภาพ'),
  score('productivity', 'ผลงาน'),
  score('teamwork', 'ทีมเวิร์ก'),
  score('responsibility', 'รับผิดชอบ'),
  { key: 'total_score', label: 'คะแนนรวม', value: (r) => r.total_score },
  { key: 'grade', label: 'เกรด', filter: 'select', align: 'center' },
]
const rowClass = (r) => (r.status === 'draft' ? '' : GRADES[r.grade]?.row || '')

const gradeKeys = Object.keys(GRADES)
const gradeLabels = gradeKeys.map((g) => `เกรด ${g}`)
const gradeColors = gradeKeys.map((g) => GRADES[g].color)
const gradeValues = computed(() => gradeKeys.map((g) => report.value?.grade_counts?.[g] || 0))
const hasGrades = computed(() => gradeValues.value.some(Boolean))
const departments = computed(() => report.value?.by_department || [])
const deptLabels = computed(() => departments.value.map((d) => d.department || '-'))
const deptSets = computed(() => [{ label: 'คะแนนเฉลี่ย', data: departments.value.map((d) => d.avg), backgroundColor: '#1baf7a', borderRadius: 4 }])
</script>

<template>
  <div>
    <PageHeader title="KPI Dashboard" subtitle="ผลประเมินประจำปี เรียงคะแนนจากมากไปน้อย">
      <label class="flex items-center gap-2 text-sm text-slate-600">
        ปี
        <select v-model.number="year" class="input w-32">
          <option v-for="y in years" :key="y" :value="y">{{ y + 543 }}</option>
        </select>
      </label>
    </PageHeader>

    <LoadingBlock v-if="loading" />
    <div v-else-if="!report" class="card">
      <EmptyState icon="⚠️" text="โหลดข้อมูลไม่สำเร็จ" />
      <div class="flex justify-center"><button class="btn-secondary" @click="load">ลองอีกครั้ง</button></div>
    </div>
    <div v-else-if="!rows.length" class="card"><EmptyState icon="🎯" text="ยังไม่มีผลประเมินในปีนี้" /></div>

    <div v-else class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-3">
        <StatCard icon="📊" label="คะแนนเฉลี่ย" :value="report.average ?? '-'" hint="จากคะแนนเต็ม 100" />
        <StatCard icon="👥" tone="sky" label="ประเมินแล้ว" :value="`${fmtNumber(finals.length)} คน`" />
        <StatCard icon="⭐" tone="amber" label="เกรด A" :value="`${fmtNumber(report.grade_counts?.A)} คน`" />
      </div>

      <section v-if="podium.length" aria-label="คนทำดีเด่น">
        <h2 class="mb-3 font-semibold text-slate-800">🏆 คนทำดีเด่น</h2>
        <div class="grid items-end gap-5 sm:grid-cols-3">
          <div v-for="p in podium" :key="p.user.id" class="min-w-0 rounded-2xl border bg-gradient-to-br p-5 text-center" :class="p.medal.card">
            <div class="text-5xl" aria-hidden="true">{{ p.medal.icon }}</div>
            <p class="mt-1 text-xs font-semibold text-slate-500">{{ p.medal.label }}</p>
            <p class="mt-1 break-words text-lg font-bold text-slate-800">{{ p.user.name }}</p>
            <p class="break-words text-xs text-slate-500">{{ p.user.department || '-' }}</p>
            <p class="mt-3 text-3xl font-bold text-slate-800">{{ p.total_score }}</p>
            <span class="mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold" :class="GRADES[p.grade]?.badge">เกรด {{ p.grade }}</span>
          </div>
        </div>
      </section>

      <div class="card min-w-0">
        <h2 class="mb-3 font-semibold text-slate-800">อันดับทั้งหมด</h2>
        <DataTable
          class="[&_.table]:!text-xs [&_.table_td]:!px-1.5 [&_.table_th]:!px-1.5 [&_thead_.input]:min-w-[3.5rem] [&_thead_.input]:!px-1"
          :columns="columns" :rows="rows" :row-key="(r) => r.user.id" :row-class="rowClass"
        >
          <template #cell-name="{ row }">
            <span class="font-medium text-slate-800">{{ row.user.name }}</span>
            <span v-if="row.status !== 'draft' && row.grade === 'A'" class="ml-1" aria-label="ดีเด่น">⭐</span>
            <StatusBadge v-if="row.status === 'draft'" class="ml-1" label="ฉบับร่าง" color="slate" />
          </template>
          <template #cell-total_score="{ row }">
            <div class="min-w-[7rem]">
              <p class="mb-1 font-semibold text-slate-800">{{ row.total_score ?? '-' }}</p>
              <ProgressBar :value="row.total_score || 0" :max="100" :color="GRADES[row.grade]?.bar" :show-text="false" />
            </div>
          </template>
          <template #cell-grade="{ row }">
            <span v-if="row.grade" class="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold" :class="GRADES[row.grade]?.badge">{{ row.grade }}</span>
            <span v-else class="text-slate-400">-</span>
          </template>
        </DataTable>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="card min-w-0">
          <h2 class="mb-3 font-semibold text-slate-800">การกระจายเกรด</h2>
          <DoughnutChart v-if="hasGrades" :labels="gradeLabels" :values="gradeValues" :colors="gradeColors" />
          <EmptyState v-else />
        </div>
        <div class="card min-w-0">
          <h2 class="mb-3 font-semibold text-slate-800">คะแนนเฉลี่ยแยกตามแผนก</h2>
          <BarChart v-if="deptLabels.length" :labels="deptLabels" :datasets="deptSets" />
          <EmptyState v-else />
        </div>
      </div>
    </div>
  </div>
</template>
