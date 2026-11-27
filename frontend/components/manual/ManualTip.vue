<script setup>
// Callout box. type: tip (เคล็ดลับ) | warn (ข้อควรระวัง) | info (ข้อมูล)
const props = defineProps({ type: { type: String, default: 'tip' }, title: String })
const STYLES = {
  tip: { box: 'border-brand-200 bg-brand-50 text-brand-800', icon: '💡', label: 'เคล็ดลับ' },
  warn: { box: 'border-amber-200 bg-amber-50 text-amber-800', icon: '⚠️', label: 'ข้อควรระวัง' },
  info: { box: 'border-sky-200 bg-sky-50 text-sky-800', icon: 'ℹ️', label: 'รู้ไว้' },
}
const s = computed(() => STYLES[props.type] || STYLES.tip)
</script>

<template>
  <div class="rounded-xl border px-4 py-3 text-sm leading-relaxed" :class="s.box">
    <p class="mb-1 font-semibold">{{ s.icon }} {{ title || s.label }}</p>
    <div><slot /></div>
  </div>
</template>
