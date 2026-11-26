<script setup>
import { apiError, dayjs, fmtDate, fmtDateTime } from '~/utils/format'

const api = useApi()
const toast = useToast()
const filters = [{ key: '', label: 'ทั้งหมด' }, { key: 'news', label: 'ข่าว' }, { key: 'event', label: 'กิจกรรม' }]
const type = ref('')
const items = ref([])
const loading = ref(true)
const selected = ref(null)
const open = ref(false)

async function load() {
  const t = type.value
  loading.value = true
  try {
    const { data } = await api.get('/announcements', { params: t ? { type: t } : {} })
    if (t === type.value) items.value = data
  } catch (e) {
    if (t === type.value) { items.value = []; toast.error(apiError(e)) }
  } finally {
    if (t === type.value) loading.value = false
  }
}
watch(type, load)
onMounted(load)

function countdown(date) {
  const n = dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day')
  if (n > 0) return { label: `อีก ${n} วัน`, color: 'emerald' }
  if (n === 0) return { label: 'วันนี้', color: 'amber' }
  return { label: 'ผ่านไปแล้ว', color: 'slate' }
}
function show(a) { selected.value = a; open.value = true }
</script>

<template>
  <div>
    <PageHeader title="ประกาศ & กิจกรรม" />
    <div class="mb-4 flex flex-wrap gap-2">
      <button v-for="f in filters" :key="f.key" :class="type === f.key ? 'btn-primary' : 'btn-secondary'" @click="type = f.key">{{ f.label }}</button>
    </div>

    <LoadingBlock v-if="loading" />
    <div v-else-if="!items.length" class="card"><EmptyState icon="📢" text="ยังไม่มีประกาศ" /></div>
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <button v-for="a in items" :key="a.id" type="button" class="card flex min-w-0 flex-col items-start gap-2 text-left transition hover:border-brand-500 hover:shadow-md" @click="show(a)">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :label="a.type === 'event' ? 'กิจกรรม' : 'ข่าว'" :color="a.type === 'event' ? 'violet' : 'sky'" />
          <StatusBadge v-if="a.pinned" label="📌 ปักหมุด" color="amber" />
        </div>
        <h2 class="line-clamp-2 w-full break-words font-semibold text-slate-800">{{ a.title }}</h2>
        <p class="line-clamp-3 w-full whitespace-pre-line break-words text-sm text-slate-500">{{ a.body }}</p>
        <div v-if="a.event_date" class="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span><span class="mr-1.5">🗓️</span>{{ fmtDate(a.event_date) }}</span>
          <StatusBadge v-bind="countdown(a.event_date)" />
        </div>
        <p class="mt-auto pt-1 text-xs text-slate-400">{{ fmtDateTime(a.created_at) }}</p>
      </button>
    </div>

    <AppModal v-model="open" :title="selected?.type === 'event' ? 'กิจกรรม' : 'ข่าว'" size="lg">
      <template v-if="selected">
        <h2 class="break-words text-lg font-bold text-slate-800">{{ selected.title }}</h2>
        <p class="mt-1 text-xs text-slate-400">{{ fmtDateTime(selected.created_at) }}<span v-if="selected.author_name"> · โดย {{ selected.author_name }}</span></p>
        <div v-if="selected.event_date" class="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span><span class="mr-2">🗓️</span>วันจัดกิจกรรม {{ fmtDate(selected.event_date) }}</span>
          <StatusBadge v-bind="countdown(selected.event_date)" />
        </div>
        <p class="mt-4 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{{ selected.body }}</p>
      </template>
      <template #footer><button class="btn-secondary" @click="open = false">ปิด</button></template>
    </AppModal>
  </div>
</template>
