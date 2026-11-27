<script setup>
// Nuxt error page: 404 for unknown routes, plus any other unhandled error.
const props = defineProps({ error: Object })
const is404 = computed(() => Number(props.error?.statusCode) === 404)
const goHome = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sky-50 p-4 font-sans text-slate-800">
    <div class="w-full max-w-md text-center">
      <p class="text-7xl font-extrabold tracking-tight text-brand-600">{{ is404 ? '404' : error?.statusCode || 'อุ๊ปส์' }}</p>
      <h1 class="mt-4 text-2xl font-bold">{{ is404 ? 'ไม่พบหน้าที่คุณต้องการ' : 'เกิดข้อผิดพลาด' }}</h1>
      <p class="mt-2 text-sm text-slate-500">
        {{ is404 ? 'หน้านี้อาจถูกย้าย ลบ หรือพิมพ์ที่อยู่ไม่ถูกต้อง' : 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' }}
      </p>
      <div class="mt-6 flex justify-center gap-2">
        <button class="btn-secondary" @click="$router.back()">ย้อนกลับ</button>
        <button class="btn-primary" @click="goHome">กลับหน้าหลัก</button>
      </div>
      <p class="mt-8 text-xs text-slate-400">TimeMint · ระบบลงเวลาพนักงาน</p>
    </div>
  </div>
</template>
