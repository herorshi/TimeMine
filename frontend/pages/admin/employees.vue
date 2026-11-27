<script setup>
import { ROLE_LABELS } from '~/utils/constants'
import { fmtDate, fmtMoney, apiError } from '~/utils/format'
definePageMeta({ roles: ['admin'] })

const api = useApi()
const auth = useAuthStore()
const toast = useToast()

const users = ref([])
const loading = ref(true)
const busy = ref(false)
const search = ref('')
const formOpen = ref(false)
const resetOpen = ref(false)
const offOpen = ref(false)
const delOpen = ref(false)
const enrollOpen = ref(false)
const faceResetOpen = ref(false)
const photoOpen = ref(false)
const selected = ref(null) // null = creating
const newPassword = ref('')
const blank = { emp_code: '', email: '', password: '', name: '', gender: 'M', role: 'employee', department: '', position: '', phone: '', address: '', birthdate: '', start_date: '', salary: 0 }
const form = reactive({ ...blank })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter((u) => [u.emp_code, u.name, u.email, u.department, u.position].some((v) => String(v || '').toLowerCase().includes(q)))
})
// only an executive can manage admin/executive accounts or grant those roles
const canManage = (u) => auth.isExecutive || u.role === 'employee'
const roleOptions = computed(() => Object.entries(ROLE_LABELS).filter(([k]) => auth.isExecutive || k === 'employee'))
const isSelf = (u) => u?.id === auth.user?.id

const genderLabel = (u) => (u.gender === 'M' ? 'ชาย' : 'หญิง')
const activeLabels = { yes: 'ใช้งาน', no: 'ปิดใช้งาน' }
const faceLabels = { yes: 'ลงทะเบียนแล้ว', no: 'ยังไม่ลงทะเบียน' }
const yesNo = (v) => (v ? 'yes' : 'no')
const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))
const columns = [
  { key: 'name', label: 'พนักงาน', value: (u) => u.name, text: (u) => `${u.name} ${u.email} ${u.emp_code} · ${genderLabel(u)}` },
  { key: 'department', label: 'แผนก', filter: 'select' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'role', label: 'สิทธิ์', filter: 'select', text: (u) => ROLE_LABELS[u.role], class: 'whitespace-nowrap' },
  { key: 'salary', label: 'เงินเดือน', value: (u) => Number(u.salary || 0), text: (u) => fmtMoney(u.salary), class: 'whitespace-nowrap' },
  { key: 'active', label: 'สถานะ', filter: 'select', options: toOptions(activeLabels), value: (u) => yesNo(u.active), text: (u) => activeLabels[yesNo(u.active)] },
  { key: 'face_enrolled', label: 'ใบหน้า', filter: 'select', options: toOptions(faceLabels), value: (u) => yesNo(u.face_enrolled), text: (u) => faceLabels[yesNo(u.face_enrolled)] },
]
const rowClass = (u) => (u.active ? '' : 'opacity-60')

async function load() {
  try { users.value = (await api.get('/users')).data } catch (e) { toast.error(apiError(e)) } finally { loading.value = false }
}
onMounted(load)

function openForm(u = null) {
  selected.value = u
  for (const k of Object.keys(blank)) form[k] = u ? u[k] ?? blank[k] : blank[k]
  formOpen.value = true
}
function openReset(u) { selected.value = u; newPassword.value = ''; resetOpen.value = true }
function openOff(u) { selected.value = u; offOpen.value = true }
function openDelete(u) { selected.value = u; delOpen.value = true }
function openEnroll(u) { selected.value = u; enrollOpen.value = true }
function openFaceReset(u) { selected.value = u; faceResetOpen.value = true }
function openPhoto(u) { selected.value = u; photoOpen.value = true }
// also reload on close, so the list is fresh even if the scanner reports nothing
watch(enrollOpen, (open) => { if (!open) load() })

/** run a request, then close the modal, toast and reload */
async function run(request, open, message) {
  busy.value = true
  try {
    await request()
    open.value = false
    toast.success(message)
    await load()
  } catch (e) { toast.error(apiError(e)) } finally { busy.value = false }
}
function save() {
  const { password, ...data } = form
  const u = selected.value
  run(() => (u ? api.put(`/users/${u.id}`, data) : api.post('/users', { ...data, password })), formOpen, u ? 'บันทึกข้อมูลแล้ว' : 'เพิ่มพนักงานแล้ว')
}
const resetPassword = () => run(() => api.post(`/users/${selected.value.id}/reset-password`, { password: newPassword.value }), resetOpen, 'ตั้งรหัสผ่านใหม่แล้ว')
const deactivate = () => run(() => api.delete(`/users/${selected.value.id}`), offOpen, 'ปิดการใช้งานแล้ว')
const resetFace = () => run(() => api.delete(`/face/enroll/${selected.value.id}`), faceResetOpen, 'รีเซ็ตใบหน้าแล้ว')
const remove = () => run(() => api.delete(`/users/${selected.value.id}/permanent`), delOpen, 'ลบบัญชีแล้ว')
async function activate(u) {
  try {
    await api.put(`/users/${u.id}`, { active: true })
    toast.success('เปิดการใช้งานแล้ว')
    await load()
  } catch (e) { toast.error(apiError(e)) }
}
</script>

<template>
  <div>
    <PageHeader title="จัดการพนักงาน">
      <NuxtLink v-if="auth.can('employees.manage')" to="/admin/faces" class="btn-secondary">สแกนใบหน้าใหม่</NuxtLink>
      <button class="btn-primary" @click="openForm()">+ เพิ่มพนักงาน</button>
    </PageHeader>

    <input v-model="search" type="search" class="input mb-4 sm:max-w-sm" placeholder="ค้นหา รหัส ชื่อ อีเมล แผนก ตำแหน่ง" />

    <DataTable :columns="columns" :rows="filtered" :loading="loading" :row-class="rowClass" empty-text="ไม่พบพนักงาน">
      <template #cell-name="{ row: u }">
        <div class="w-44">
          <p class="break-words font-medium">{{ u.name }}</p>
          <p class="truncate text-xs text-slate-400" :title="u.email">{{ u.email }}</p>
          <p class="text-xs text-slate-400">{{ u.emp_code }} · {{ genderLabel(u) }}</p>
        </div>
      </template>
      <template #cell-active="{ row: u }">
        <StatusBadge :color="u.active ? 'emerald' : 'rose'" :label="activeLabels[yesNo(u.active)]" />
      </template>
      <template #cell-face_enrolled="{ row: u }">
        <div class="flex items-center gap-2">
          <button v-if="u.face_enrolled && u.face_photo_url" type="button" class="shrink-0" :aria-label="`ดูรูปลงทะเบียนใบหน้าของ ${u.name}`" @click="openPhoto(u)">
            <img :src="u.face_photo_url" alt="" class="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
          </button>
          <div class="whitespace-nowrap">
            <StatusBadge :color="u.face_enrolled ? 'emerald' : 'slate'" :label="faceLabels[yesNo(u.face_enrolled)]" />
            <p v-if="u.face_enrolled && u.face_enrolled_at" class="mt-0.5 text-xs text-slate-400">{{ fmtDate(u.face_enrolled_at) }}</p>
          </div>
        </div>
      </template>
      <template #actions="{ row: u }">
        <div v-if="canManage(u)" class="ml-auto flex w-48 flex-wrap justify-end gap-1.5">
          <button class="btn-secondary btn-sm" @click="openForm(u)">แก้ไข</button>
          <button class="btn-secondary btn-sm" @click="openReset(u)">รีเซ็ตรหัส</button>
          <button v-if="u.face_enrolled" class="btn-secondary btn-sm" @click="openFaceReset(u)">รีเซ็ตใบหน้า</button>
          <button v-else-if="u.active" class="btn-primary btn-sm" @click="openEnroll(u)">สแกนลงทะเบียนใบหน้า</button>
          <button v-if="u.active && !isSelf(u)" class="btn-secondary btn-sm" @click="openOff(u)">ปิดใช้งาน</button>
          <button v-else-if="!u.active" class="btn-secondary btn-sm" @click="activate(u)">เปิดใช้งาน</button>
          <button v-if="!isSelf(u)" class="btn-danger btn-sm" @click="openDelete(u)">ลบ</button>
        </div>
        <span v-else class="text-slate-400">-</span>
      </template>
    </DataTable>

    <AppModal v-model="formOpen" :title="selected ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'" size="lg">
      <form id="employee-form" class="grid gap-3 sm:grid-cols-2" @submit.prevent="save">
        <div><label class="label">รหัสพนักงาน</label><input v-model="form.emp_code" class="input" required /></div>
        <div><label class="label">ชื่อ-นามสกุล</label><input v-model="form.name" class="input" required /></div>
        <div><label class="label">อีเมล</label><input v-model="form.email" type="email" class="input" required autocomplete="off" /></div>
        <div v-if="!selected"><label class="label">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label><PasswordInput v-model="form.password" required minlength="6" autocomplete="new-password"  /></div>
        <div><label class="label">เพศ</label><select v-model="form.gender" class="input"><option value="M">ชาย</option><option value="F">หญิง</option></select></div>
        <div>
          <label class="label">สิทธิ์การใช้งาน</label>
          <select v-model="form.role" class="input" :disabled="isSelf(selected)"><option v-for="[k, label] in roleOptions" :key="k" :value="k">{{ label }}</option></select>
        </div>
        <div><label class="label">แผนก</label><input v-model="form.department" class="input" /></div>
        <div><label class="label">ตำแหน่ง</label><input v-model="form.position" class="input" /></div>
        <div><label class="label">เงินเดือน (บาท)</label><input v-model.number="form.salary" type="number" min="0" step="0.01" class="input" required /></div>
        <div><label class="label">เบอร์โทร</label><PhoneInput v-model="form.phone" /></div>
        <div><label class="label">วันเกิด</label><DateInput v-model="form.birthdate" clearable /></div>
        <div><label class="label">วันเริ่มงาน</label><DateInput v-model="form.start_date" clearable /></div>
        <div class="sm:col-span-2"><label class="label">ที่อยู่</label><textarea v-model="form.address" rows="2" class="input" /></div>
      </form>
      <template #footer>
        <button type="button" class="btn-secondary" @click="formOpen = false">ยกเลิก</button>
        <button type="submit" form="employee-form" class="btn-primary" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />บันทึก</button>
      </template>
    </AppModal>

    <AppModal v-model="resetOpen" title="รีเซ็ตรหัสผ่าน" size="sm">
      <form id="reset-form" @submit.prevent="resetPassword">
        <p class="mb-3 text-sm text-slate-600">ตั้งรหัสผ่านใหม่ให้ {{ selected?.name }}</p>
        <label class="label">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
        <PasswordInput v-model="newPassword" required minlength="6" autocomplete="new-password"  />
      </form>
      <template #footer>
        <button type="button" class="btn-secondary" @click="resetOpen = false">ยกเลิก</button>
        <button type="submit" form="reset-form" class="btn-primary" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />ยืนยัน</button>
      </template>
    </AppModal>

    <AppModal v-model="enrollOpen" :title="`สแกนลงทะเบียนใบหน้า: ${selected?.name || ''}`">
      <FaceEnroll v-if="enrollOpen" :user-id="selected.id" :user-name="selected.name" @changed="load" />
    </AppModal>

    <AppModal v-model="photoOpen" title="รูปหลักฐานการลงทะเบียนใบหน้า">
      <img :src="selected?.face_photo_url" :alt="`รูปใบหน้าของ ${selected?.name}`" class="mx-auto max-h-[60vh] rounded-xl" />
      <p class="mt-3 text-center text-sm text-slate-600">{{ selected?.name }} · ลงทะเบียน {{ fmtDate(selected?.face_enrolled_at) }}</p>
    </AppModal>

    <ConfirmModal v-model="faceResetOpen" title="รีเซ็ตใบหน้า" :message="`รีเซ็ตข้อมูลใบหน้าของ ${selected?.name}? ต้องสแกนลงทะเบียนใหม่ก่อนจึงจะใช้สแกนใบหน้าได้`" confirm-text="รีเซ็ต" danger :loading="busy" @confirm="resetFace" />
    <ConfirmModal v-model="offOpen" title="ปิดการใช้งานพนักงาน" :message="`ปิดการใช้งานบัญชีของ ${selected?.name}? พนักงานจะเข้าสู่ระบบไม่ได้`" confirm-text="ปิดใช้งาน" danger :loading="busy" @confirm="deactivate" />
    <ConfirmModal v-model="delOpen" title="ลบบัญชีถาวร" :message="`ลบบัญชีของ ${selected?.name} และข้อมูลการเข้างาน การลา OT และใบเตือนทั้งหมดอย่างถาวร? ไม่สามารถกู้คืนได้`" confirm-text="ลบถาวร" danger :loading="busy" @confirm="remove" />
  </div>
</template>
