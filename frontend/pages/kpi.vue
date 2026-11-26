<script setup>
// My annual KPI — contract: docs/kpi.md (GET /kpi/me, GET /kpi/years)
const api = useApi()
const toast = useToast()

const currentYear = Number(todayStr().slice(0, 4))
const year = ref(currentYear)
const years = ref([currentYear])
const result = ref(null)
const loading = ref(true)

let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const { data } = await api.get('/kpi/me', { params: { year: year.value } })
    if (mine !== seq) return
    result.value = data
  } catch (e) {
    if (mine !== seq) return
    result.value = null
    toast.error(apiError(e))
  } finally {
    if (mine === seq) loading.value = false
  }
}
async function loadYears() {
  try {
    const { data } = await api.get('/kpi/years')
    const list = Array.isArray(data) ? data : data.years || []
    years.value = [...new Set([currentYear, ...list])].sort((a, b) => b - a)
  } catch (e) {
    toast.error(apiError(e))
  }
}
watch(year, load)
onMounted(() => { loadYears(); load() })

// drafts are never shown to the employee
const evaluation = computed(() => {
  const e = result.value?.evaluation
  return e && e.status !== 'draft' && e.total_score !== null ? e : null
})

const GRADES = {
  A: { ring: '#10b981', badge: 'bg-emerald-100 text-emerald-700', text: 'ดีเยี่ยม ⭐' },
  B: { ring: '#0ea5e9', badge: 'bg-sky-100 text-sky-700', text: 'ดีมาก' },
  C: { ring: '#64748b', badge: 'bg-slate-200 text-slate-700', text: 'ดี' },
  D: { ring: '#f59e0b', badge: 'bg-amber-100 text-amber-700', text: 'พอใช้' },
  F: { ring: '#f43f5e', badge: 'bg-rose-100 text-rose-700', text: 'ต้องปรับปรุง' },
}
const grade = computed(() => GRADES[evaluation.value?.grade] || GRADES.C)
const RADIUS = 52
const LENGTH = 2 * Math.PI * RADIUS
const dashOffset = computed(() => LENGTH * (1 - Math.min(100, Math.max(0, evaluation.value?.total_score || 0)) / 100))

const criteria = computed(() => [
  { label: 'การเข้างาน', value: evaluation.value.attendance_score, max: 100, color: 'brand' },
  { label: 'คุณภาพงาน', value: evaluation.value.quality, max: 5, color: 'sky' },
  { label: 'ผลงาน', value: evaluation.value.productivity, max: 5, color: 'violet' },
  { label: 'การทำงานเป็นทีม', value: evaluation.value.teamwork, max: 5, color: 'amber' },
  { label: 'ความรับผิดชอบ', value: evaluation.value.responsibility, max: 5, color: 'rose' },
])
</script>

<template>
  <div>
    <PageHeader title="KPI ของฉัน" subtitle="ผลประเมินประจำปี">
      <label class="flex items-center gap-2 text-sm text-slate-600">
        ปี
        <select v-model.number="year" class="input w-32">
          <option v-for="y in years" :key="y" :value="y">{{ y + 543 }}</option>
        </select>
      </label>
    </PageHeader>

    <LoadingBlock v-if="loading" />
    <div v-else-if="!result" class="card">
      <EmptyState icon="⚠️" text="โหลดข้อมูลไม่สำเร็จ" />
      <div class="flex justify-center"><button class="btn-secondary" @click="load">ลองอีกครั้ง</button></div>
    </div>

    <div v-else class="space-y-6">
      <div v-if="evaluation" class="grid gap-6 lg:grid-cols-2">
        <div class="card flex flex-col items-center justify-center gap-3">
          <div class="relative h-48 w-48">
            <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" :r="RADIUS" fill="none" stroke="#f1f5f9" stroke-width="10" />
              <circle cx="60" cy="60" :r="RADIUS" fill="none" :stroke="grade.ring" stroke-width="10" stroke-linecap="round" :stroke-dasharray="LENGTH" :stroke-dashoffset="dashOffset" />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <p class="text-4xl font-bold text-slate-800">{{ evaluation.total_score }}</p>
              <p class="text-xs text-slate-400">เต็ม 100</p>
            </div>
          </div>
          <span class="rounded-full px-4 py-1 text-sm font-bold" :class="grade.badge">เกรด {{ evaluation.grade }} · {{ grade.text }}</span>
        </div>

        <div class="card min-w-0 space-y-4">
          <h2 class="font-semibold text-slate-800">คะแนนรายหัวข้อ</h2>
          <ProgressBar v-for="c in criteria" :key="c.label" :label="c.label" :value="c.value || 0" :max="c.max" :color="c.color" />
        </div>
      </div>
      <div v-else class="card"><EmptyState icon="🎯" text="ยังไม่มีผลประเมิน" /></div>

      <section v-if="result.attendance">
        <h2 class="mb-3 font-semibold text-slate-800">รายละเอียดการเข้างาน</h2>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon="✅" label="คะแนนเข้างาน (ปัจจุบัน)" :value="result.attendance.score" />
          <StatCard icon="⏰" tone="amber" label="มาสาย" :value="`${fmtNumber(result.attendance.late_count)} ครั้ง`" />
          <StatCard icon="⌛" tone="sky" label="เวลาสายรวม" :value="fmtMinutes(result.attendance.late_minutes)" />
          <StatCard icon="🚫" tone="rose" label="ขาดงาน" :value="`${fmtNumber(result.attendance.absent_days)} วัน`" />
          <StatCard icon="⚠️" tone="violet" label="ใบเตือน" :value="`${fmtNumber(result.attendance.warnings)} ใบ`" />
        </div>
      </section>

      <div v-if="evaluation" class="card">
        <h2 class="mb-2 font-semibold text-slate-800">ความเห็นผู้ประเมิน</h2>
        <p class="whitespace-pre-line break-words text-sm text-slate-600">{{ evaluation.comment || 'ไม่มีความเห็นเพิ่มเติม' }}</p>
      </div>
    </div>
  </div>
</template>
