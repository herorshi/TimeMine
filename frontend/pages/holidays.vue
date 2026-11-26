<script setup>
import { apiError, dayjs, fmtDate, todayStr } from '~/utils/format'

const api = useApi()
const toast = useToast()
const thisYear = new Date().getFullYear()
const today = todayStr()
const year = ref(thisYear)
const years = ref([thisYear, thisYear - 1])
const shown = ref(null) // { year, holidays }: swapped only when data arrives, so the old year slides out intact
const loading = ref(true)
const direction = ref('next')
const active = ref(null) // date of the open popover

async function load() {
  const y = year.value
  loading.value = true
  try {
    const { data } = await api.get('/holidays', { params: { year: y } })
    if (y === year.value) shown.value = { year: y, holidays: data }
  } catch (e) {
    if (y === year.value) { shown.value = { year: y, holidays: [] }; toast.error(apiError(e)) }
  } finally {
    if (y === year.value) loading.value = false
  }
}
watch(year, () => { active.value = null; load() })
onMounted(async () => {
  load()
  try {
    const { data } = await api.get('/holidays/years')
    years.value = data.filter((y) => y <= thisYear || y === year.value)
  } catch (e) { toast.error(apiError(e)) }
})

const sortedYears = computed(() => [...new Set([...years.value, year.value])].sort((a, b) => a - b))
const prevYear = computed(() => sortedYears.value[sortedYears.value.indexOf(year.value) - 1])
const nextYear = computed(() => sortedYears.value[sortedYears.value.indexOf(year.value) + 1])
function go(y) {
  if (!y) return
  direction.value = y > year.value ? 'next' : 'prev'
  year.value = y
}

const holidays = computed(() => shown.value?.holidays || [])
const weekdayCount = computed(() => holidays.value.filter((h) => ![0, 6].includes(dayjs(h.date).day())).length)
const weekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const months = computed(() => {
  if (!shown.value) return []
  const byDate = Object.fromEntries(holidays.value.map((h) => [h.date, h.name]))
  return Array.from({ length: 12 }, (_, m) => {
    const first = dayjs(new Date(shown.value.year, m, 1))
    const offset = first.day()
    const days = Array.from({ length: first.daysInMonth() }, (_, i) => {
      const d = first.date(i + 1)
      const date = d.format('YYYY-MM-DD')
      return { n: i + 1, date, col: (offset + i) % 7, holiday: byDate[date], weekend: d.day() === 0 || d.day() === 6 }
    })
    return { name: first.format('MMMM BBBB'), offset, days, count: days.filter((d) => d.holiday).length }
  })
})
const upcoming = computed(() => holidays.value
  .filter((h) => h.date >= today)
  .sort((a, b) => a.date.localeCompare(b.date))
  .slice(0, 6)
  .map((h) => ({ ...h, left: dayjs(h.date).diff(dayjs(today), 'day') })))

// keep the popover inside its card on the edge columns
const popClass = (col) => (col < 2 ? 'left-0' : col > 4 ? 'right-0' : 'left-1/2 -translate-x-1/2')
const dayClass = (d) => [
  d.holiday
    ? 'bg-gradient-to-br from-rose-400 to-rose-600 font-semibold text-white shadow-sm'
    : d.weekend ? 'bg-slate-100 text-slate-400' : 'text-slate-700',
  d.date === today ? 'ring-2 ring-brand-500 ring-offset-1' : '',
]
const close = (date) => { if (active.value === date) active.value = null }
</script>

<template>
  <div>
    <PageHeader title="ปฏิทินวันหยุด" subtitle="วันหยุดบริษัทประจำปี">
      <div class="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button class="arrow" :disabled="!prevYear" aria-label="ปีก่อนหน้า" @click="go(prevYear)">‹</button>
        <div class="relative w-32 overflow-hidden text-center font-semibold text-slate-800" aria-live="polite">
          <Transition :name="`slide-${direction}`" mode="out-in">
            <span :key="year" class="block py-1">พ.ศ. {{ year + 543 }}</span>
          </Transition>
        </div>
        <button class="arrow" :disabled="!nextYear" aria-label="ปีถัดไป" @click="go(nextYear)">›</button>
      </div>
    </PageHeader>

    <LoadingBlock v-if="!shown" />
    <div v-else class="overflow-x-clip transition-opacity" :class="{ 'opacity-60': loading }" :aria-busy="loading">
      <Transition :name="`slide-${direction}`" mode="out-in">
        <div :key="shown.year">
          <div class="mb-4 grid gap-4 sm:grid-cols-2">
            <StatCard :label="`วันหยุดทั้งหมด พ.ศ. ${shown.year + 543}`" :value="`${holidays.length} วัน`" icon="📅" tone="rose" />
            <StatCard label="ตรงกับวันจันทร์-ศุกร์" :value="`${weekdayCount} วัน`" icon="🌴" />
          </div>

          <div class="card mb-4">
            <h2 class="mb-3 font-semibold text-slate-800">วันหยุดที่กำลังจะมาถึง</h2>
            <EmptyState v-if="!upcoming.length" icon="🗓️" text="ไม่มีวันหยุดที่กำลังจะมาถึงในปีนี้" />
            <ol v-else class="ml-2 border-l-2 border-rose-100">
              <li v-for="(h, i) in upcoming" :key="h.id" class="rise relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 pl-5" :style="{ animationDelay: `${i * 60}ms` }">
                <i class="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white" :class="i === 0 ? 'bg-rose-500' : 'bg-rose-300'" />
                <div class="min-w-0">
                  <p class="text-sm font-medium text-slate-700">{{ h.name }}</p>
                  <p class="text-xs text-slate-500">{{ dayjs(h.date).format('dddd') }} {{ fmtDate(h.date) }}</p>
                </div>
                <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="i === 0 ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600'">
                  {{ h.left ? `อีก ${h.left} วัน` : 'วันนี้' }}
                </span>
              </li>
            </ol>
          </div>

          <div class="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span class="flex items-center gap-1.5"><i class="h-3 w-3 rounded bg-rose-500" />วันหยุด (แตะเพื่อดูชื่อ)</span>
            <span class="flex items-center gap-1.5"><i class="h-3 w-3 rounded bg-slate-200" />เสาร์-อาทิตย์</span>
            <span class="flex items-center gap-1.5"><i class="h-3 w-3 rounded ring-2 ring-brand-500" />วันนี้</span>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="(m, mi) in months" :key="m.name" class="rise relative" :class="{ 'z-10': m.days.some((d) => d.date === active) }" :style="{ animationDelay: `${mi * 40}ms` }">
              <div class="card h-full !p-4">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h2 class="font-semibold text-slate-800">{{ m.name }}</h2>
                  <span v-if="m.count" class="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">{{ m.count }} วัน</span>
                </div>
                <div class="grid grid-cols-7 gap-1 text-center text-xs">
                  <span v-for="(w, wi) in weekdays" :key="w" class="py-1 font-medium" :class="wi === 0 || wi === 6 ? 'text-rose-300' : 'text-slate-400'">{{ w }}</span>
                  <span v-for="i in m.offset" :key="`b${i}`" />
                  <template v-for="d in m.days" :key="d.date">
                    <span v-if="d.holiday" class="relative">
                      <button
                        type="button" class="chip w-full rounded-lg py-1.5" :class="dayClass(d)" :aria-label="`${fmtDate(d.date)} ${d.holiday}`"
                        @mouseenter="active = d.date" @mouseleave="close(d.date)" @focus="active = d.date" @blur="close(d.date)"
                        @click="active = d.date" @keydown.esc="active = null"
                      >{{ d.n }}</button>
                      <Transition name="pop">
                        <span v-if="active === d.date" role="tooltip" class="pointer-events-none absolute bottom-full z-20 mb-1.5" :class="popClass(d.col)">
                          <span class="pop-body block w-max max-w-[11rem] rounded-lg bg-slate-800 px-3 py-2 text-left text-white shadow-lg">
                            <span class="block font-semibold">{{ d.holiday }}</span>
                            <span class="block text-slate-300">{{ fmtDate(d.date) }}</span>
                          </span>
                        </span>
                      </Transition>
                    </span>
                    <span v-else class="rounded-lg py-1.5" :class="dayClass(d)">{{ d.n }}</span>
                  </template>
                </div>
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
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.arrow { @apply flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30; }

.slide-next-enter-active, .slide-next-leave-active, .slide-prev-enter-active, .slide-prev-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.slide-next-enter-from, .slide-prev-leave-to { opacity: 0; transform: translateX(32px); }
.slide-next-leave-to, .slide-prev-enter-from { opacity: 0; transform: translateX(-32px); }

/* backwards (not both): no transform stays behind once the entrance ends */
.rise { animation: rise 0.35s ease backwards; }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }

.chip { transition: transform 0.15s ease; }
.chip:hover, .chip:focus-visible { transform: scale(1.12); }

.pop-enter-active, .pop-leave-active, .pop-enter-active .pop-body, .pop-leave-active .pop-body { transition: opacity 0.15s ease, transform 0.15s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; }
.pop-enter-from .pop-body, .pop-leave-to .pop-body { transform: translateY(4px) scale(0.96); }

@media (prefers-reduced-motion: reduce) {
  .slide-next-enter-active, .slide-next-leave-active, .slide-prev-enter-active, .slide-prev-leave-active,
  .pop-enter-active, .pop-leave-active, .pop-enter-active .pop-body, .pop-leave-active .pop-body, .chip { transition: none; }
  .rise { animation: none; }
}
</style>
