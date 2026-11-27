<script setup>
// Wraps one manual topic: header, access check, body slot, related links, prev/next.
// <ManualPage slug="checkin" :related="['profile','admin-faces']" intro="...">…steps…</ManualPage>
import { findTopic, visibleManual, canRead } from '~/utils/manualToc'
const props = defineProps({ slug: { type: String, required: true }, intro: String, related: { type: Array, default: () => [] } })
const auth = useAuthStore()
const topic = computed(() => findTopic(props.slug))
if (!canRead(auth, props.slug)) navigateTo('/manual', { replace: true })

const flat = computed(() => visibleManual(auth).flatMap((g) => g.topics))
const idx = computed(() => flat.value.findIndex((t) => t.slug === props.slug))
const prev = computed(() => flat.value[idx.value - 1])
const next = computed(() => flat.value[idx.value + 1])
const relatedTopics = computed(() => props.related.filter((s) => canRead(auth, s)).map(findTopic).filter(Boolean))
useHead(() => ({ title: `${topic.value?.title || 'คู่มือ'} · คู่มือ TimeMint` }))
</script>

<template>
  <article v-if="topic" class="mx-auto max-w-3xl">
    <NuxtLink to="/manual" class="text-sm text-brand-700 hover:underline">📖 คู่มือการใช้งาน</NuxtLink>
    <div class="mt-2 mb-6 flex flex-wrap items-start justify-between gap-3">
      <h1 class="text-2xl font-bold text-slate-800"><span class="mr-2">{{ topic.icon }}</span>{{ topic.title }}</h1>
      <NuxtLink v-if="topic.route && topic.route !== '/login'" :to="topic.route" class="btn-secondary btn-sm">เปิดหน้านี้ในระบบ →</NuxtLink>
    </div>
    <p v-if="intro" class="mb-6 text-[15px] leading-relaxed text-slate-600">{{ intro }}</p>
    <div class="space-y-6"><slot /></div>

    <section v-if="relatedTopics.length" class="mt-10 rounded-2xl bg-slate-50 p-5">
      <h2 class="mb-3 font-semibold text-slate-700">หัวข้อที่เกี่ยวข้อง</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink v-for="t in relatedTopics" :key="t.slug" :to="`/manual/${t.slug}`" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-brand-300 hover:text-brand-700">
          {{ t.icon }} {{ t.title }}
        </NuxtLink>
      </div>
    </section>

    <nav class="mt-8 flex justify-between gap-3 border-t border-slate-200 pt-5 text-sm">
      <NuxtLink v-if="prev" :to="`/manual/${prev.slug}`" class="text-slate-600 hover:text-brand-700">← {{ prev.title }}</NuxtLink><span v-else />
      <NuxtLink v-if="next" :to="`/manual/${next.slug}`" class="text-right text-slate-600 hover:text-brand-700">{{ next.title }} →</NuxtLink>
    </nav>
  </article>
</template>
