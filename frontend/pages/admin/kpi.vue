<script setup>
import { apiError, fmtNumber } from '~/utils/format'

definePageMeta({ roles: ['admin'], perm: 'kpi.manage' })

const api = useApi()
const toast = useToast()
const auth = useAuthStore()

// เกณฑ์ตาม docs/kpi.md
const CRITERIA = [
  { key: 'quality', label: 'คุณภาพงาน', desc: 'ความถูกต้อง ครบถ้วน และได้มาตรฐานของงานที่ส่งมอบ' },
  { key: 'productivity', label: 'ปริมาณและประสิทธิภาพงาน', desc: 'ปริมาณงานที่ทำสำเร็จ ตรงตามกำหนดเวลา' },
  { key: 'teamwork', label: 'การทำงานเป็นทีม', desc: 'การสื่อสาร การช่วยเหลือ และการร่วมงานกับผู้อื่น' },
  { key: 'responsibility', label: 'ความรับผิดชอบ', desc: 'ความใส่ใจต่อหน้าที่ การติดตามงาน และการรักษาคำพูด' },
]
const LEVELS = { 1: 'ต้องปรับปรุง', 2: 'พอใช้', 3: 'ปานกลาง', 4: 'ดี', 5: 'ดีเยี่ยม' }
const GRADE_COLORS = { A: 'emerald', B: 'sky', C: 'violet', D: 'amber', F: 'rose' }
const KPI_STATUS = { none: { label: 'ยังไม่ประเมิน', color: 'slate' }, draft: { label: 'ฉบับร่าง', color: 'amber' }, final: { label: 'ยืนยันผลแล้ว', color: 'emerald' } }

const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10
const gradeOf = (t) => (t >= 90 ? 'A' : t >= 80 ? 'B' : t >= 70 ? 'C' : t >= 60 ? 'D' : 'F')
const statusOf = (r) => r.evaluation?.status || 'none'

const thisYear = new Date().getFullYear()
const year = ref(thisYear)
const years = ref([thisYear])
const rows = ref([])
const loading = ref(true)
let seq = 0

async function load(silent = false) {
  const mine = ++seq
  if (!silent) { loading.value = true; rows.value = [] }
  try {
    const { data } = await api.get('/kpi/candidates', { params: { year: year.value } })
    if (mine === seq) rows.value = Array.isArray(data) ? data : data.rows || []
  } catch (e) {
    if (mine === seq) { rows.value = []; toast.error(apiError(e)) }
  } finally {
    if (mine === seq) loading.value = false
  }
}
async function loadYears() {
  try {
    const { data } = await api.get('/kpi/years')
    const list = (Array.isArray(data) ? data : data.years || []).map(Number)
    years.value = [...new Set([thisYear, ...list])].sort((a, b) => b - a)
  } catch (e) {
    toast.error(apiError(e))
  }
}
onMounted(() => { loadYears(); load() })
watch(year, () => load())

const done = computed(() => rows.value.filter((r) => statusOf(r) === 'final').length)
const drafts = computed(() => rows.value.filter((r) => statusOf(r) === 'draft').length)

const breakdown = (a = {}) =>
  `มาสาย ${a.late_count ?? 0} ครั้ง (${a.late_minutes ?? 0} นาที)\nขาดงาน ${a.absent_days ?? 0} วัน\nใบเตือน ${a.warnings ?? 0} ใบ`

const columns = [
  { key: 'emp_code', label: 'รหัส', value: (r) => r.user.emp_code, class: 'whitespace-nowrap' },
  { key: 'name', label: 'ชื่อ', value: (r) => r.user.name, class: 'whitespace-nowrap' },
  { key: 'department', label: 'แผนก', filter: 'select', value: (r) => r.user.department, class: 'whitespace-nowrap' },
  { key: 'attendance', label: 'คะแนนเข้างาน', value: (r) => r.attendance?.score },
  { key: 'total', label: 'คะแนนรวม', value: (r) => r.evaluation?.total_score ?? null },
  { key: 'grade', label: 'เกรด', filter: 'select', options: Object.keys(GRADE_COLORS).map((g) => ({ value: g, label: g })), value: (r) => r.evaluation?.grade ?? null },
  { key: 'status', label: 'สถานะ', filter: 'select', options: Object.entries(KPI_STATUS).map(([value, s]) => ({ value, label: s.label })), value: statusOf },
]

// ---- ประเมิน ----
const showForm = ref(false)
const showConfirm = ref(false)
const saving = ref(null) // 'draft' | 'final'
const target = ref(null)
const formYear = ref(thisYear)
const form = reactive({ quality: null, productivity: null, teamwork: null, responsibility: null, comment: '' })

const isSelf = (r) => r.user.id === auth.user?.id
// ผลที่ยืนยันแล้ว แก้ไขได้เฉพาะผู้บริหาร
const locked = (r) => statusOf(r) === 'final' && !auth.isExecutive
const readonly = computed(() => !!target.value && locked(target.value))
const complete = computed(() => CRITERIA.every((c) => form[c.key]))
const preview = computed(() => {
  // ยืนยันผลแล้วและแก้ไม่ได้: แสดงคะแนนที่บันทึกไว้
  if (readonly.value) return { attendance: target.value.evaluation.attendance_score, total: target.value.evaluation.total_score, grade: target.value.evaluation.grade }
  const attendance = target.value?.attendance?.score ?? 0
  const manual = complete.value ? CRITERIA.reduce((s, c) => s + 0.2 * form[c.key] * 20, 0) : 0
  const total = round1(0.2 * attendance + manual)
  return { attendance, total, grade: complete.value ? gradeOf(total) : null }
})

function openForm(row) {
  target.value = row
  formYear.value = year.value
  for (const c of CRITERIA) form[c.key] = row.evaluation?.[c.key] || null
  form.comment = row.evaluation?.comment || ''
  showForm.value = true
}

async function save(status) {
  if (saving.value) return
  saving.value = status
  try {
    const body = { comment: form.comment.trim(), status }
    for (const c of CRITERIA) body[c.key] = form[c.key]
    await api.put(`/kpi/evaluations/${target.value.user.id}`, body, { params: { year: formYear.value } })
    toast.success(status === 'final' ? 'ยืนยันผลการประเมินแล้ว' : 'บันทึกร่างแล้ว')
    showConfirm.value = false
    showForm.value = false
    await load(true)
    loadYears()
  } catch (e) {
    showConfirm.value = false
    toast.error(apiError(e))
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader title="ประเมิน KPI" subtitle="ประเมินผลการปฏิบัติงานประจำปี">
      <label class="flex items-center gap-2 text-sm text-slate-600">
        ปี
        <select v-model.number="year" class="input !w-auto" aria-label="เลือกปี">
          <option v-for="y in years" :key="y" :value="y">{{ y + 543 }}</option>
        </select>
      </label>
    </PageHeader>

    <div class="card mb-4">
      <ProgressBar :value="done" :max="rows.length" :label="`ยืนยันผลแล้ว ปี ${year + 543}`" suffix=" คน" />
      <p v-if="drafts" class="mt-2 text-xs text-slate-500">ฉบับร่างรอยืนยัน {{ fmtNumber(drafts) }} คน</p>
    </div>

    <DataTable class="[&_thead_input]:min-w-[6rem] [&_thead_select]:min-w-[6rem]" :columns="columns" :rows="rows" :row-key="(r) => r.user.id" :loading="loading" empty-text="ไม่มีพนักงานให้ประเมิน">
      <template #cell-attendance="{ row, value }">
        <span class="cursor-help whitespace-nowrap underline decoration-dotted underline-offset-4" :title="breakdown(row.attendance)" tabindex="0">{{ value ?? '-' }}</span>
      </template>
      <template #cell-grade="{ value }">
        <StatusBadge v-if="value" :label="value" :color="GRADE_COLORS[value]" />
        <span v-else>-</span>
      </template>
      <template #cell-status="{ value }">
        <StatusBadge :label="KPI_STATUS[value].label" :color="KPI_STATUS[value].color" />
      </template>
      <template #actions="{ row }">
        <span v-if="isSelf(row)" class="text-xs text-slate-400">ประเมินตนเองไม่ได้</span>
        <button v-else class="btn-sm" :class="locked(row) ? 'btn-secondary' : 'btn-primary'" @click="openForm(row)">{{ locked(row) ? 'ดูผล' : 'ประเมิน' }}</button>
      </template>
    </DataTable>

    <AppModal v-model="showForm" :title="`ประเมิน KPI ปี ${formYear + 543}`" size="lg" :persistent="!!saving || showConfirm">
      <div v-if="target" class="space-y-4">
        <div>
          <p class="font-semibold text-slate-800">{{ target.user.name }}</p>
          <p class="text-xs text-slate-500">{{ [target.user.emp_code, target.user.department, target.user.position].filter(Boolean).join(' · ') }}</p>
        </div>
        <p v-if="readonly" class="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">ยืนยันผลแล้ว เฉพาะผู้บริหารเท่านั้นที่เปิดแก้ไขได้</p>

        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium text-slate-700">การเข้างาน (คำนวณอัตโนมัติ)</p>
            <p class="whitespace-nowrap text-lg font-bold text-slate-800">{{ preview.attendance }} <span class="text-xs font-normal text-slate-400">/ 100</span></p>
          </div>
          <dl class="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div><dt class="text-slate-500">มาสาย</dt><dd class="font-medium text-slate-700">{{ fmtNumber(target.attendance?.late_count) }} ครั้ง</dd></div>
            <div><dt class="text-slate-500">สายรวม</dt><dd class="font-medium text-slate-700">{{ fmtNumber(target.attendance?.late_minutes) }} นาที</dd></div>
            <div><dt class="text-slate-500">ขาดงาน</dt><dd class="font-medium text-slate-700">{{ fmtNumber(target.attendance?.absent_days) }} วัน</dd></div>
            <div><dt class="text-slate-500">ใบเตือน</dt><dd class="font-medium text-slate-700">{{ fmtNumber(target.attendance?.warnings) }} ใบ</dd></div>
          </dl>
        </div>

        <fieldset v-for="c in CRITERIA" :key="c.key" :disabled="readonly || !!saving">
          <legend class="text-sm font-medium text-slate-700">{{ c.label }}</legend>
          <p class="mb-2 text-xs text-slate-500">{{ c.desc }}</p>
          <div class="grid grid-cols-5 gap-1">
            <button v-for="n in 5" :key="n" type="button" class="rounded-lg border px-1 py-2 text-center transition-colors disabled:cursor-not-allowed" :class="form[c.key] === n ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600 enabled:hover:bg-slate-50'" :aria-pressed="form[c.key] === n" :aria-label="`${c.label} ${n} คะแนน ${LEVELS[n]}`" @click="form[c.key] = n">
              <span class="block text-sm font-semibold">{{ n }} ★</span>
              <span class="block text-[10px] leading-tight sm:text-xs">{{ LEVELS[n] }}</span>
            </button>
          </div>
        </fieldset>

        <div class="flex items-center justify-between gap-2 rounded-xl border border-brand-100 px-3 py-2" aria-live="polite">
          <div>
            <p class="text-sm font-medium text-slate-700">คะแนนรวม</p>
            <p v-if="!readonly && !complete" class="text-xs text-slate-500">ให้คะแนนครบ 4 ด้านเพื่อดูเกรดและยืนยันผล (ตอนนี้นับเฉพาะการเข้างาน)</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-2xl font-bold text-slate-800">{{ preview.total }}</span>
            <StatusBadge v-if="preview.grade" :label="`เกรด ${preview.grade}`" :color="GRADE_COLORS[preview.grade]" />
          </div>
        </div>

        <div>
          <label class="label" for="kpi-comment">ความคิดเห็น</label>
          <textarea id="kpi-comment" v-model="form.comment" class="input" rows="3" :disabled="readonly || !!saving" />
        </div>
      </div>
      <template #footer>
        <button v-if="readonly" class="btn-secondary" @click="showForm = false">ปิด</button>
        <template v-else>
          <button class="btn-secondary" :disabled="!!saving" @click="save('draft')"><Spinner v-if="saving === 'draft'" class="h-4 w-4" />บันทึกร่าง</button>
          <button class="btn-primary" :disabled="!!saving || !complete" @click="showConfirm = true">ยืนยันผล</button>
        </template>
      </template>
    </AppModal>

    <ConfirmModal v-model="showConfirm" title="ยืนยันผลการประเมิน" :message="target ? `ยืนยันผลของ ${target.user.name}: ${preview.total} คะแนน (เกรด ${preview.grade}) หลังยืนยันแล้ว เฉพาะผู้บริหารเท่านั้นที่แก้ไขได้` : ''" confirm-text="ยืนยันผล" :loading="!!saving" @confirm="save('final')" />
  </div>
</template>
