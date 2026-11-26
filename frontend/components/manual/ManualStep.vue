<script setup>
// One numbered step: <ManualStep :n="1" title="กดปุ่ม ลงเวลาเข้างาน">body, <ManualShot>, <ManualTip></ManualStep>
defineProps({ n: { type: Number, required: true }, title: { type: String, required: true } })
</script>

<template>
  <section class="flex gap-4">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{{ n }}</div>
    <div class="min-w-0 flex-1 space-y-3 pt-0.5">
      <h3 class="font-semibold text-slate-800">{{ title }}</h3>
      <div class="space-y-3 text-[15px] leading-relaxed text-slate-600"><slot /></div>
    </div>
  </section>
</template>
