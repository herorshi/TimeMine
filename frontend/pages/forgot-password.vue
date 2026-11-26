<script setup>
import { apiError } from '~/utils/format'
definePageMeta({ layout: 'blank' })
const api = useApi()
const toast = useToast()
const email = ref('')
const busy = ref(false)
const sent = ref(false)
const previewUrl = ref('')
const notFound = ref('')
async function submit() {
  busy.value = true
  notFound.value = ''
  try {
    const { data } = await api.post('/password/forgot', { email: email.value })
    previewUrl.value = data.preview_url || ''
    sent.value = true
  } catch (e) {
    if (e?.response?.status === 404) notFound.value = apiError(e)
    else toast.error(apiError(e))
  } finally { busy.value = false }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sky-50 p-4">
    <div class="w-full max-w-md">
      <div class="mb-6 text-center">
        <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl text-white shadow-lg">⏱</div>
        <h1 class="text-2xl font-bold">ลืมรหัสผ่าน</h1>
        <p class="text-sm text-slate-500">กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่</p>
      </div>
      <div v-if="sent" class="card space-y-4 text-center">
        <p class="text-sm text-slate-700">ส่งลิงก์ตั้งรหัสผ่านไปที่ <span class="font-medium break-all">{{ email }}</span> แล้ว<br />(ลิงก์มีอายุ 30 นาที)</p>
        <a v-if="previewUrl" :href="previewUrl" target="_blank" rel="noopener noreferrer" class="block text-xs text-slate-500 underline">เปิดอีเมลทดสอบ</a>
        <NuxtLink to="/login" class="btn-primary w-full">กลับไปหน้าเข้าสู่ระบบ</NuxtLink>
      </div>
      <form v-else class="card space-y-4" @submit.prevent="submit">
        <div><label class="label">อีเมล</label><input v-model="email" type="email" class="input" required autocomplete="username" @input="notFound = ''" />
          <p v-if="notFound" class="mt-1 text-sm text-red-600">{{ notFound }}</p></div>
        <button class="btn-primary w-full" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />ส่งลิงก์ตั้งรหัสผ่าน</button>
        <div class="text-center"><NuxtLink to="/login" class="text-sm font-medium text-brand-700 hover:underline">กลับไปหน้าเข้าสู่ระบบ</NuxtLink></div>
      </form>
    </div>
  </div>
</template>
