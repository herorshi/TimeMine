<script setup>
import { ROLE_LABELS } from '~/utils/constants'
import { fmtDate, fmtDateTime, fmtMoney, apiError } from '~/utils/format'

const api = useApi()
const auth = useAuthStore()
const toast = useToast()

const user = ref(null)
const loading = ref(true)
const busy = ref(false)
const editOpen = ref(false)
const passOpen = ref(false)
const form = reactive({ name: '', phone: '', address: '', birthdate: '', avatar_url: '' })
const pass = reactive({ current: '', next: '', confirm: '' })

async function load() {
  try {
    user.value = (await api.get('/users/me')).data
    auth.user = user.value
  } catch (e) { toast.error(apiError(e)) } finally { loading.value = false }
}
onMounted(load)

// face enrollment is done by an admin: the employee only sees the status
const face = ref(null)
const faceError = ref('')
onMounted(async () => {
  try { face.value = (await api.get('/face/status')).data } catch (e) { faceError.value = apiError(e) }
})

const fields = computed(() => {
  const u = user.value
  return [
    ['รหัสพนักงาน', u.emp_code], ['อีเมล', u.email], ['ชื่อ-นามสกุล', u.name],
    ['เพศ', u.gender === 'M' ? 'ชาย' : 'หญิง'], ['สิทธิ์การใช้งาน', ROLE_LABELS[u.role]],
    ['แผนก', u.department], ['ตำแหน่ง', u.position], ['เบอร์โทร', u.phone],
    ['วันเกิด', fmtDate(u.birthdate)], ['วันเริ่มงาน', fmtDate(u.start_date)],
    ['เงินเดือน', fmtMoney(u.salary)],
    ['ที่อยู่', u.address],
  ]
})

function openEdit() {
  for (const k of Object.keys(form)) form[k] = user.value[k] || ''
  editOpen.value = true
}
function openPass() {
  Object.assign(pass, { current: '', next: '', confirm: '' })
  passOpen.value = true
}
async function saveProfile() {
  busy.value = true
  try {
    user.value = (await api.put('/users/me', { ...form })).data
    auth.user = user.value
    editOpen.value = false
    toast.success('บันทึกข้อมูลแล้ว')
  } catch (e) { toast.error(apiError(e)) } finally { busy.value = false }
}
async function savePassword() {
  if (pass.next !== pass.confirm) return toast.error('รหัสผ่านใหม่ไม่ตรงกัน')
  busy.value = true
  try {
    await api.post('/auth/change-password', { current: pass.current, next: pass.next })
    passOpen.value = false
    toast.success('เปลี่ยนรหัสผ่านแล้ว')
  } catch (e) { toast.error(apiError(e)) } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="ข้อมูลส่วนตัว">
      <button class="btn-secondary" :disabled="!user" @click="openPass">เปลี่ยนรหัสผ่าน</button>
      <button class="btn-primary" :disabled="!user" @click="openEdit">แก้ไขข้อมูล</button>
    </PageHeader>

    <LoadingBlock v-if="loading" />
    <div v-else-if="!user" class="card"><EmptyState text="โหลดข้อมูลไม่สำเร็จ" /></div>
    <div v-else class="space-y-5">
      <div class="card">
        <div class="mb-5 flex items-center gap-4">
          <img v-if="user.avatar_url" :src="user.avatar_url" alt="รูปโปรไฟล์" class="h-20 w-20 shrink-0 rounded-full object-cover" />
          <div v-else class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-3xl font-semibold text-brand-700">{{ user.name?.[0] }}</div>
          <div class="min-w-0">
            <p class="break-words text-lg font-bold text-slate-800">{{ user.name }}</p>
            <p class="text-sm text-slate-500">{{ user.position || '-' }} · {{ user.department || '-' }}</p>
          </div>
        </div>
        <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="[label, value] in fields" :key="label" class="min-w-0">
            <dt class="text-xs text-slate-400">{{ label }}</dt>
            <dd class="break-words text-sm font-medium text-slate-700">{{ value || '-' }}</dd>
          </div>
        </dl>
      </div>
      <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-semibold text-slate-800">ใบหน้าสำหรับสแกนเข้างาน</h2>
          <StatusBadge v-if="face" :label="face.enrolled ? 'ลงทะเบียนแล้ว' : 'ยังไม่ได้ลงทะเบียน'" :color="face.enrolled ? 'emerald' : 'amber'" />
        </div>
        <p v-if="faceError" class="mt-3 text-sm text-rose-600" role="alert">{{ faceError }}</p>
        <LoadingBlock v-else-if="!face" />
        <div v-else-if="face.enrolled" class="mt-3 flex flex-wrap items-center gap-4">
          <img v-if="face.photo_url" :src="face.photo_url" alt="รูปใบหน้าที่ลงทะเบียน" class="h-24 w-24 shrink-0 rounded-xl object-cover" />
          <p class="text-sm text-slate-500">ลงทะเบียนเมื่อ {{ fmtDateTime(face.enrolled_at) }}</p>
        </div>
        <p v-else class="mt-3 text-sm text-amber-700">กรุณาติดต่อ admin เพื่อลงทะเบียนใบหน้า</p>
      </div>
    </div>

    <AppModal v-model="editOpen" title="แก้ไขข้อมูลส่วนตัว">
      <form id="profile-form" class="space-y-3" @submit.prevent="saveProfile">
        <div><label class="label">ชื่อ-นามสกุล</label><input v-model="form.name" class="input" required /></div>
        <div><label class="label">เบอร์โทร</label><input v-model="form.phone" type="tel" class="input" /></div>
        <div><label class="label">วันเกิด</label><input v-model="form.birthdate" type="date" class="input" /></div>
        <div><label class="label">ที่อยู่</label><textarea v-model="form.address" rows="3" class="input" /></div>
        <div><label class="label">ลิงก์รูปโปรไฟล์</label><input v-model="form.avatar_url" type="url" class="input" placeholder="https://..." /></div>
      </form>
      <template #footer>
        <button type="button" class="btn-secondary" @click="editOpen = false">ยกเลิก</button>
        <button type="submit" form="profile-form" class="btn-primary" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />บันทึก</button>
      </template>
    </AppModal>

    <AppModal v-model="passOpen" title="เปลี่ยนรหัสผ่าน" size="sm">
      <form id="password-form" class="space-y-3" @submit.prevent="savePassword">
        <div><label class="label">รหัสผ่านเดิม</label><PasswordInput v-model="pass.current" required autocomplete="current-password"  /></div>
        <div><label class="label">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label><PasswordInput v-model="pass.next" required minlength="6" autocomplete="new-password"  /></div>
        <div><label class="label">ยืนยันรหัสผ่านใหม่</label><PasswordInput v-model="pass.confirm" required minlength="6" autocomplete="new-password"  /></div>
      </form>
      <template #footer>
        <button type="button" class="btn-secondary" @click="passOpen = false">ยกเลิก</button>
        <button type="submit" form="password-form" class="btn-primary" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />เปลี่ยนรหัสผ่าน</button>
      </template>
    </AppModal>
  </div>
</template>
