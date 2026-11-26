<script setup>
const { items } = useToast()
const tone = { success: 'border-emerald-200 bg-emerald-50 text-emerald-800', error: 'border-rose-200 bg-rose-50 text-rose-800', info: 'border-sky-200 bg-sky-50 text-sky-800', warning: 'border-amber-200 bg-amber-50 text-amber-800' }
const icon = { success: '✅', error: '⛔', info: 'ℹ️', warning: '⚠️' }
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
    <TransitionGroup enter-from-class="translate-x-8 opacity-0" leave-to-class="translate-x-8 opacity-0" enter-active-class="transition duration-300" leave-active-class="transition duration-200">
      <div v-for="t in items" :key="t.id" class="pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg" :class="tone[t.type]">
        <span>{{ icon[t.type] }}</span><span>{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
