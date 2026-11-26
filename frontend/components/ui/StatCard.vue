<script setup>
defineProps({ label: String, value: [String, Number], hint: String, icon: String, tone: { type: String, default: 'brand' } })
const tones = { brand: 'bg-brand-50 text-brand-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700', sky: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', slate: 'bg-slate-100 text-slate-700' }
</script>

<template>
  <div class="card flex items-center gap-4">
    <div v-if="icon" class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" :class="tones[tone]">{{ icon }}</div>
    <div class="min-w-0">
      <p class="truncate text-xs font-medium text-slate-500">{{ label }}</p>
      <p class="truncate text-xl font-bold text-slate-800">{{ value }}</p>
      <p v-if="hint" class="truncate text-xs text-slate-400">{{ hint }}</p>
    </div>
  </div>
</template>
