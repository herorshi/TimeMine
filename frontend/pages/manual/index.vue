<script setup>
// Manual home: every topic the reader may open, grouped by role.
import { visibleManual } from '~/utils/manualToc'
definePageMeta({ layout: 'manual' })
useHead({ title: 'คู่มือการใช้งาน · TimeMint' })
const auth = useAuthStore()
const groups = computed(() => visibleManual(auth))
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="text-2xl font-bold text-slate-800">📖 คู่มือการใช้งาน TimeMint</h1>
    <p class="mt-2 text-[15px] leading-relaxed text-slate-600">
      เลือกเรื่องที่อยากรู้ได้เลย แต่ละหัวข้อบอกทีละขั้นตอน พร้อมภาพหน้าจอ ถ้าเพิ่งเริ่มใช้ แนะนำให้อ่าน
      <ManualLink to="getting-started" /> ก่อน แล้วต่อด้วย <ManualLink to="checkin" />
    </p>
    <section v-for="g in groups" :key="g.key" class="mt-8">
      <h2 class="mb-3 text-lg font-semibold text-slate-700">{{ g.title }}</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink v-for="t in g.topics" :key="t.slug" :to="`/manual/${t.slug}`" class="card card-hover flex items-center gap-3 !p-4">
          <span class="text-2xl">{{ t.icon }}</span>
          <span class="font-medium text-slate-700">{{ t.title }}</span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
