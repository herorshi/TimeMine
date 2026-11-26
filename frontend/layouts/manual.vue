<script setup>
// Layout for /manual/*: the sidebar becomes the manual's table of contents (see utils/manualToc.js).
// Pages opt in with definePageMeta({ layout: 'manual' }).
import { visibleManual } from '~/utils/manualToc'
const auth = useAuthStore()
const route = useRoute()
const mobileOpen = ref(false)
watch(() => route.path, () => (mobileOpen.value = false))
const groups = computed(() => visibleManual(auth))
const isActive = (slug) => route.path === `/manual/${slug}`
</script>

<template>
  <div class="flex min-h-screen">
    <div v-if="mobileOpen" class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" @click="mobileOpen = false" />
    <aside class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0" :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'">
      <NuxtLink to="/manual" class="flex items-center gap-2 px-5 py-5">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg text-white">📖</div>
        <div><p class="font-bold text-slate-800">คู่มือการใช้งาน</p><p class="text-xs text-slate-400">TimeMint</p></div>
      </NuxtLink>
      <nav class="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <NuxtLink to="/manual" class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition" :class="route.path === '/manual' ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'">
          <span class="w-5 text-center">📚</span>สารบัญทั้งหมด
        </NuxtLink>
        <div v-for="g in groups" :key="g.key">
          <p class="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ g.title }}</p>
          <NuxtLink v-for="t in g.topics" :key="t.slug" :to="`/manual/${t.slug}`" class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition" :class="isActive(t.slug) ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'">
            <span class="w-5 text-center">{{ t.icon }}</span>{{ t.title }}
          </NuxtLink>
        </div>
      </nav>
      <div class="border-t border-slate-100 p-4">
        <NuxtLink to="/" class="btn-secondary w-full">← กลับเข้าระบบ</NuxtLink>
      </div>
    </aside>
    <div class="flex min-w-0 flex-1 flex-col lg:pl-64">
      <header class="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <button class="rounded-lg p-2 hover:bg-slate-100" aria-label="สารบัญคู่มือ" @click="mobileOpen = true">☰</button>
        <span class="font-bold">คู่มือการใช้งาน</span>
        <NuxtLink to="/" class="ml-auto text-sm text-brand-700">กลับเข้าระบบ</NuxtLink>
      </header>
      <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"><slot /></main>
    </div>
  </div>
</template>
