<script setup>
import { apiError } from '~/utils/format'
definePageMeta({ layout: 'blank' })
const auth = useAuthStore()
const toast = useToast()
const route = useRoute()
const form = reactive({ email: '', password: '' })
const busy = ref(false)
const demo = [
  ['พนักงาน (ชาย)', 'somchai@timemint.local', 'emp123'],
  ['พนักงาน (หญิง)', 'somsri@timemint.local', 'emp123'],
  ['Admin', 'admin@timemint.local', 'admin123'],
  ['ผู้บริหาร', 'exec@timemint.local', 'exec123'],
]
async function submit() {
  busy.value = true
  try {
    await auth.login(form.email, form.password)
    toast.success(`ยินดีต้อนรับ ${auth.user.name}`)
    navigateTo(auth.isExecutive ? '/executive' : '/')
  } catch (e) { toast.error(apiError(e)) } finally { busy.value = false }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sky-50 p-4">
    <div class="w-full max-w-md">
      <div class="mb-6 text-center">
        <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl text-white shadow-lg">⏱</div>
        <h1 class="text-2xl font-bold">TimeMint</h1>
        <p class="text-sm text-slate-500">ระบบลงเวลาและบริหารบุคคล</p>
      </div>
      <div v-if="route.query.expired" role="alert" class="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่
      </div>
      <form class="card space-y-4" @submit.prevent="submit">
        <div><label class="label">อีเมล</label><input v-model="form.email" type="email" class="input" required autocomplete="username" /></div>
        <div><label class="label">รหัสผ่าน</label><PasswordInput v-model="form.password" required autocomplete="current-password"  /></div>
        <div class="flex justify-end"><NuxtLink to="/forgot-password" class="text-sm font-medium text-brand-700 hover:underline">ลืมรหัสผ่าน?</NuxtLink></div>
        <button class="btn-primary w-full" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />เข้าสู่ระบบ</button>
      </form>
      <div class="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4">
        <p class="mb-2 text-xs font-semibold text-slate-500">บัญชีทดลอง (คลิกเพื่อกรอก)</p>
        <div class="grid grid-cols-2 gap-2">
          <button v-for="d in demo" :key="d[1]" type="button" class="btn-secondary btn-sm" @click="form.email = d[1]; form.password = d[2]">{{ d[0] }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
