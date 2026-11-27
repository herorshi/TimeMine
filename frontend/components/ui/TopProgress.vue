<script setup>
// Thin bar at the top while any API request is in flight.
const inflight = useState('api-inflight', () => 0)
const width = ref(0)
let timer
watch(() => inflight.value > 0, (busy) => {
  clearInterval(timer)
  if (busy) {
    width.value = 10
    timer = setInterval(() => { width.value = Math.min(90, width.value + (90 - width.value) * 0.15) }, 150)
  } else {
    width.value = 100
    setTimeout(() => { if (inflight.value === 0) width.value = 0 }, 300)
  }
})
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
    <div class="h-full bg-brand-500 transition-all duration-300" :style="{ width: width + '%', opacity: width ? 1 : 0 }" />
  </div>
</template>
