<script setup>
import { apiError, dayjs, fmtDate, todayStr } from '~/utils/format'

const api = useApi()
const toast = useToast()
const thisYear = new Date().getFullYear()
const today = todayStr()
const year = ref(thisYear)
const years = ref([thisYear, thisYear - 1])
const holidays = ref([])
const loading = ref(true)

async function load() {
  const y = year.value
  loading.value = true
  try {
    const { data } = await api.get('/holidays', { params: { year: y } })
    if (y === year.value) holidays.value = data
  } catch (e) {
    if (y === year.value) { holidays.value = []; toast.error(apiError(e)) }
  } finally {
    if (y === year.value) loading.value = false
  }
}
watch(year, load)
onMounted(async () => {
  load()
  try {
    const { data } = await api.get('/holidays/years')
    years.value = data.filter((y) => y <= thisYear || y === year.value)
  } catch (e) { toast.error(apiError(e)) }
})

const byDate = computed(() => Object.fromEntries(holidays.value.map((h) => [h.date, h.name])))
const weekdayCount = computed(() => holidays.value.filter((h) => ![0, 6].includes(dayjs(h.date).day())).length)
const weekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const months = computed(() => Array.from({ length: 12 }, (_, m) => {
  const first = dayjs(new Date(year.value, m, 1))
  const days = Array.from({ length: first.daysInMonth() }, (_, i) => {
    const d = first.date(i + 1)
    const date = d.format('YYYY-MM-DD')
    return { n: i + 1, date, holiday: byDate.value[date], weekend: d.day() === 0 || d.day() === 6 }
  })
  return { name: first.format('MMMM'), offset: first.day(), days }
}))
const dayClass = (d) => [
  d.holiday ? 'bg-rose-500 font-semibold text-white' : d.weekend ? 'bg-slate-100 text-slate-400' : 'text-slate-700',
  d.date === today ? 'ring-2 ring-brand-500' : '',
]
</script>

<template>
  <div>
    <PageHeader title="ปฏิทินวันหยุด" subtitle="วันหยุดบริษัทประจำปี">
      <select v-model.number="year" class="input w-36" aria-label="เลือกปี">
        <option v-for="y in years" :key="y" :value="y">พ.ศ. {{ y + 543 }}</option>
      </select>
    </PageHeader>

    <LoadingBlock v-if="loading" />
    <template v-else>
      <div class="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="วันหยุดทั้งหมด" :value="`${holidays.length} วัน`" icon="📅" tone="rose" />
        <StatCard label="ตรงกับวันจันทร์-ศุกร์" :value="`${weekdayCount} วัน`" icon="🌴" />
      </div>

      <div class="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <span class="flex items-center gap-1.5"><i class="h-3 w-3 rounded bg-rose-500" />วันหยุด</span>
        <span class="flex items-center gap-1.5"><i class="h-3 w-3 rounded bg-slate-200" />เสาร์-อาทิตย์</span>
        <span class="flex items-center gap-1.5"><i class="h-3 w-3 rounded ring-2 ring-brand-500" />วันนี้</span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="m in months" :key="m.name" class="card !p-4">
          <h2 class="mb-2 font-semibold text-slate-800">{{ m.name }}</h2>
          <div class="grid grid-cols-7 gap-1 text-center text-xs">
            <span v-for="w in weekdays" :key="w" class="py-1 font-medium text-slate-400">{{ w }}</span>
            <span v-for="i in m.offset" :key="`b${i}`" />
            <span v-for="d in m.days" :key="d.date" class="rounded-lg py-1.5" :class="dayClass(d)" :title="d.holiday">{{ d.n }}</span>
          </div>
        </div>
      </div>

      <div class="card mt-6">
        <h2 class="mb-3 font-semibold text-slate-800">รายการวันหยุด ({{ holidays.length }} วัน)</h2>
        <EmptyState v-if="!holidays.length" icon="📅" text="ยังไม่มีวันหยุดในปีนี้" />
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="h in holidays" :key="h.id" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
            <span class="font-medium text-slate-700">{{ h.name }}</span>
            <span class="text-slate-500">{{ dayjs(h.date).format('dddd') }} {{ fmtDate(h.date) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
