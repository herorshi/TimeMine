<script setup>
defineProps({ title: String, subtitle: String })
</script>

<template>
  <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
    </div>
    <div class="flex flex-wrap gap-2"><slot /></div>
  </div>
</template>
