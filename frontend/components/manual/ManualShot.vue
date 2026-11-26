<script setup>
// Screenshot from public/manual/. <ManualShot name="checkin-1" caption="หน้าลงเวลา" />
// Missing file shows a placeholder box instead of a broken image. Click opens the full-size image.
const props = defineProps({ name: { type: String, required: true }, caption: String, alt: String })
const src = computed(() => `/manual/${props.name}.png`)
const broken = ref(false)
</script>

<template>
  <figure class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <a v-if="!broken" :href="src" target="_blank" rel="noopener" title="กดเพื่อดูภาพใหญ่">
      <img :src="src" :alt="alt || caption || name" loading="lazy" class="block w-full" @error="broken = true">
    </a>
    <div v-else class="flex h-40 items-center justify-center bg-slate-50 text-sm text-slate-400">🖼️ ภาพประกอบ ({{ name }})</div>
    <figcaption v-if="caption" class="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">{{ caption }}</figcaption>
  </figure>
</template>
