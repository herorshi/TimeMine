<script setup>
import { WARNING_LEVELS, WARNING_CATEGORIES } from '~/utils/constants'
import { fmtDateTime, apiError } from '~/utils/format'

const api = useApi()
const toast = useToast()
const loading = ref(true)
const items = ref([])
const activeCount = computed(() => items.value.filter((w) => w.status === 'active').length)

onMounted(async () => {
  try { items.value = (await api.get('/warnings/me')).data }
  catch (e) { toast.error(apiError(e)) }
  finally { loading.value = false }
})
</script>

<template>
  <div>
    <PageHeader title="ใบเตือนของฉัน" :subtitle="loading ? '' : `ใบเตือนที่มีผล ${activeCount} ใบ`" />
    <LoadingBlock v-if="loading" />
    <div v-else-if="!items.length" class="card"><EmptyState icon="🎉" text="คุณไม่มีใบเตือน" /></div>
    <div v-else class="space-y-3">
      <div v-for="w in items" :key="w.id" class="card">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="font-semibold text-slate-800">{{ WARNING_LEVELS[w.level] || w.level }}</p>
            <p class="text-xs text-slate-500">{{ WARNING_CATEGORIES[w.category] || w.category }} · {{ fmtDateTime(w.issued_at) }} · โดย {{ w.issued_by_name || '-' }}</p>
          </div>
          <StatusBadge :status="w.status" />
        </div>
        <p class="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{{ w.reason }}</p>
        <div v-if="w.status === 'cancelled'" class="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          <p class="whitespace-pre-wrap break-words"><span class="font-medium">เหตุผลที่ยกเลิก:</span> {{ w.cancel_reason || '-' }}</p>
          <p class="mt-1 text-xs text-slate-400">ยกเลิกเมื่อ {{ fmtDateTime(w.cancelled_at) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
