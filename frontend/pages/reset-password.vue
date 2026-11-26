<script setup>
import { apiError } from '~/utils/format'
definePageMeta({ layout: 'blank' })
const api = useApi()
const toast = useToast()
const route = useRoute()
const token = String(route.query.token || '')
const state = ref('loading') // loading | valid | invalid
const emailMasked = ref('')
const errorMessage = ref('ลิงก์หมดอายุหรือถูกใช้ไปแล้ว')
const form = reactive({ password: '', confirm: '' })
const busy = ref(false)

onMounted(async () => {
  if (!token) { state.value = 'invalid'; return }
  try {
    const { data } = await api.get('/password/verify', { params: { token } })
    emailMasked.value = data.email_masked
    state.value = 'valid'
  } catch (e) {
    errorMessage.value = apiError(e)
    state.value = 'invalid'
  }
})

async function submit() {
  if (form.password.length < 6) return toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
  if (form.password !== form.confirm) return toast.error('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
  busy.value = true
  try {
    await api.post('/password/reset', { token, password: form.password })
    toast.success('ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ')
    // drop any old session, otherwise /login redirects a signed-in browser to /
    useAuthStore().logout()
    await navigateTo('/login', { replace: true })
  } catch (e) { toast.error(apiError(e)) } finally { busy.value = false }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sky-50 p-4">
    <div class="w-full max-w-md">
      <div class="mb-6 text-center">
        <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl text-white shadow-lg">⏱</div>
        <h1 class="text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1>
        <p v-if="state === 'valid'" class="break-all text-sm text-slate-500">บัญชี {{ emailMasked }}</p>
      </div>
      <div v-if="state === 'loading'" class="card flex items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner />กำลังตรวจสอบลิงก์...
      </div>
      <div v-else-if="state === 'invalid'" class="card space-y-4 text-center">
        <p class="text-sm font-medium text-rose-600">{{ errorMessage }}</p>
        <NuxtLink to="/forgot-password" class="btn-primary w-full">ขอลิงก์ใหม่</NuxtLink>
      </div>
      <form v-else class="card space-y-4" @submit.prevent="submit">
        <div><label class="label">รหัสผ่านใหม่</label><PasswordInput v-model="form.password" required minlength="6" autocomplete="new-password"  /></div>
        <div><label class="label">ยืนยันรหัสผ่านใหม่</label><PasswordInput v-model="form.confirm" required minlength="6" autocomplete="new-password"  /></div>
        <button class="btn-primary w-full" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />บันทึกรหัสผ่านใหม่</button>
      </form>
    </div>
  </div>
</template>
