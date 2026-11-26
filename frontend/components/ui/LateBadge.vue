<script setup>
// <LateBadge :minutes="r.late_minutes" /> — yellow / red by the late_yellow_min / late_red_min settings.
import { fmtMinutes } from '~/utils/format'
const props = defineProps({ minutes: { type: Number, default: 0 }, prefix: { type: String, default: 'สาย ' }, empty: { type: String, default: '-' } })
const { lateLevel } = useAppSettings()
const level = computed(() => lateLevel(props.minutes))
const cls = { yellow: 'bg-amber-100 text-amber-800 ring-amber-200', red: 'bg-rose-100 text-rose-700 ring-rose-200' }
</script>

<template>
  <span v-if="minutes > 0 && level !== 'none'" class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1" :class="cls[level]">
    <span aria-hidden="true">{{ level === 'red' ? '🔴' : '🟡' }}</span>{{ prefix }}{{ fmtMinutes(minutes) }}
  </span>
  <span v-else-if="minutes > 0" class="whitespace-nowrap text-xs text-slate-500">{{ prefix }}{{ fmtMinutes(minutes) }}</span>
  <span v-else class="text-slate-400">{{ empty }}</span>
</template>
