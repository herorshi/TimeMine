<script setup>
import { STATUS } from '~/utils/constants'
const props = defineProps({ status: String, label: String, color: String })
const c = computed(() => props.color || STATUS[props.status]?.color || 'slate')
const cls = { amber: 'bg-amber-100 text-amber-700', emerald: 'bg-emerald-100 text-emerald-700', rose: 'bg-rose-100 text-rose-700', slate: 'bg-slate-100 text-slate-600', sky: 'bg-sky-100 text-sky-700', violet: 'bg-violet-100 text-violet-700' }
</script>

<template>
  <span class="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium" :class="cls[c]">{{ label || STATUS[status]?.label || status }}</span>
</template>
