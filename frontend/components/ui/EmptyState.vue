<script setup>
defineProps({ icon: { type: String, default: '📭' }, text: { type: String, default: 'ยังไม่มีข้อมูล' } })
</script>

<template>
  <div class="flex flex-col items-center justify-center py-10 text-slate-400">
    <div class="mb-2 text-4xl">{{ icon }}</div>
    <p class="text-sm">{{ text }}</p>
  </div>
</template>
