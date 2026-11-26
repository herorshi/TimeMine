<script setup>
import { apiError } from '~/utils/format'
import { cleanEmail, isEmail, EMAIL_PATTERN, EMAIL_HINT } from '~/utils/validate'
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
const scanOpen = ref(false)
const faceError = ref('')
function welcome() {
  toast.success(`ยินดีต้อนรับ ${auth.user.name}`)
  navigateTo(auth.isExecutive ? '/executive' : '/')
}
function openScan() {
  faceError.value = ''
  scanOpen.value = true
}
async function onCaptured({ descriptor, photo }) {
  busy.value = true
  try {
    await auth.faceLogin(descriptor, photo)
    welcome()
  } catch (e) {
    // the server sends the Thai reason (no face found / ambiguous / locked)
    faceError.value = e?.response?.data?.error || 'สแกนใบหน้าเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่'
    toast.error(faceError.value)
  } finally { busy.value = false }
}
async function submit() {
  if (!isEmail(form.email)) return toast.error('รูปแบบอีเมลไม่ถูกต้อง')
  busy.value = true
  try {
    await auth.login(form.email, form.password)
    welcome()
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
        <div><label class="label">อีเมล</label><input v-model="form.email" type="email" class="input" required autocomplete="username" inputmode="email" :pattern="EMAIL_PATTERN" :title="EMAIL_HINT" @input="form.email = cleanEmail(form.email)" /></div>
        <div><label class="label">รหัสผ่าน</label><PasswordInput v-model="form.password" required autocomplete="current-password"  /></div>
        <div class="flex justify-end"><NuxtLink to="/forgot-password" class="text-sm font-medium text-brand-700 hover:underline">ลืมรหัสผ่าน?</NuxtLink></div>
        <button class="btn-primary w-full" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />เข้าสู่ระบบ</button>
        <button type="button" class="btn-secondary w-full" :disabled="busy" @click="openScan">📷 สแกนใบหน้าเพื่อเข้าสู่ระบบ</button>
        <p v-if="faceError" role="alert" class="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">{{ faceError }}</p>
      </form>
      <FaceScanner v-model="scanOpen" title="สแกนใบหน้าเพื่อเข้าสู่ระบบ" @captured="onCaptured" />
      <div class="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4">
        <p class="mb-2 text-xs font-semibold text-slate-500">บัญชีทดลอง (คลิกเพื่อกรอก)</p>
        <div class="grid grid-cols-2 gap-2">
          <button v-for="d in demo" :key="d[1]" type="button" class="btn-secondary btn-sm" @click="form.email = d[1]; form.password = d[2]">{{ d[0] }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
