<script setup>
// <ProgressBar :value="3" :max="10" label="ลาป่วย" color="brand" show-text />
const props = defineProps({ value: { type: Number, default: 0 }, max: { type: Number, default: 100 }, label: String, color: { type: String, default: 'brand' }, showText: { type: Boolean, default: true }, suffix: { type: String, default: '' } })
const pct = computed(() => (props.max > 0 ? Math.min(100, Math.round((props.value / props.max) * 100)) : 0))
const bar = { brand: 'bg-brand-500', amber: 'bg-amber-500', rose: 'bg-rose-500', sky: 'bg-sky-500', violet: 'bg-violet-500', slate: 'bg-slate-500' }
</script>

<template>
  <div>
    <div v-if="label || showText" class="mb-1 flex justify-between text-xs">
      <span class="font-medium text-slate-600">{{ label }}</span>
      <span v-if="showText" class="text-slate-500">{{ value }}{{ suffix }} / {{ max }}{{ suffix }}</span>
    </div>
    <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div class="progress-fill h-full w-full rounded-full" :class="bar[color] || bar.brand" :style="{ transform: `translateX(${pct - 100}%)` }" />
    </div>
  </div>
</template>
