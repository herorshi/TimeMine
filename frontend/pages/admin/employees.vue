<script setup>
import { ROLE_LABELS } from '~/utils/constants'
import { fmtMoney, apiError } from '~/utils/format'
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
const selected = ref(null) // null = creating
const newPassword = ref('')
const blank = { emp_code: '', email: '', password: '', name: '', gender: 'M', role: 'employee', department: '', position: '', phone: '', address: '', birthdate: '', start_date: '', salary: 0 }
const form = reactive({ ...blank })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter((u) => [u.emp_code, u.name, u.email, u.department, u.position].some((v) => String(v || '').toLowerCase().includes(q)))
})
// only an executive can manage executive accounts or grant that role
const canManage = (u) => auth.isExecutive || u.role !== 'executive'
const roleOptions = computed(() => Object.entries(ROLE_LABELS).filter(([k]) => auth.isExecutive || k !== 'executive'))
const isSelf = (u) => u?.id === auth.user?.id

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
      <button class="btn-primary" @click="openForm()">+ เพิ่มพนักงาน</button>
    </PageHeader>

    <input v-model="search" type="search" class="input mb-4 sm:max-w-sm" placeholder="ค้นหา รหัส ชื่อ อีเมล แผนก ตำแหน่ง" />

    <LoadingBlock v-if="loading" />
    <div v-else-if="!filtered.length" class="card"><EmptyState text="ไม่พบพนักงาน" /></div>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>รหัส</th><th>ชื่อ</th><th>แผนก</th><th>ตำแหน่ง</th><th>สิทธิ์</th><th>เพศ</th><th>เงินเดือน</th><th>ใบหน้า</th><th>สถานะ</th><th>จัดการ</th></tr>
        </thead>
        <tbody>
          <tr v-for="u in filtered" :key="u.id" :class="{ 'opacity-60': !u.active }">
            <td class="whitespace-nowrap">{{ u.emp_code }}</td>
            <td class="whitespace-nowrap"><p class="font-medium">{{ u.name }}</p><p class="text-xs text-slate-400">{{ u.email }}</p></td>
            <td class="whitespace-nowrap">{{ u.department || '-' }}</td>
            <td class="whitespace-nowrap">{{ u.position || '-' }}</td>
            <td class="whitespace-nowrap">{{ ROLE_LABELS[u.role] }}</td>
            <td>{{ u.gender === 'M' ? 'ชาย' : 'หญิง' }}</td>
            <td class="whitespace-nowrap">{{ fmtMoney(u.salary) }}</td>
            <td><StatusBadge :color="u.face_enrolled ? 'emerald' : 'slate'" :label="u.face_enrolled ? 'ลงทะเบียนแล้ว' : 'ยังไม่ลงทะเบียน'" /></td>
            <td><StatusBadge :color="u.active ? 'emerald' : 'rose'" :label="u.active ? 'ใช้งาน' : 'ปิดใช้งาน'" /></td>
            <td>
              <div v-if="canManage(u)" class="flex gap-2 whitespace-nowrap">
                <button class="btn-secondary btn-sm" @click="openForm(u)">แก้ไข</button>
                <button class="btn-secondary btn-sm" @click="openReset(u)">รีเซ็ตรหัส</button>
                <button v-if="u.active && !isSelf(u)" class="btn-danger btn-sm" @click="openOff(u)">ปิดใช้งาน</button>
                <button v-else-if="!u.active" class="btn-secondary btn-sm" @click="activate(u)">เปิดใช้งาน</button>
              </div>
              <span v-else class="text-slate-400">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppModal v-model="formOpen" :title="selected ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'" size="lg">
      <form id="employee-form" class="grid gap-3 sm:grid-cols-2" @submit.prevent="save">
        <div><label class="label">รหัสพนักงาน</label><input v-model="form.emp_code" class="input" required /></div>
        <div><label class="label">ชื่อ-นามสกุล</label><input v-model="form.name" class="input" required /></div>
        <div><label class="label">อีเมล</label><input v-model="form.email" type="email" class="input" required autocomplete="off" /></div>
        <div v-if="!selected"><label class="label">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label><input v-model="form.password" type="password" class="input" required minlength="6" autocomplete="new-password" /></div>
        <div><label class="label">เพศ</label><select v-model="form.gender" class="input"><option value="M">ชาย</option><option value="F">หญิง</option></select></div>
        <div>
          <label class="label">สิทธิ์การใช้งาน</label>
          <select v-model="form.role" class="input" :disabled="isSelf(selected)"><option v-for="[k, label] in roleOptions" :key="k" :value="k">{{ label }}</option></select>
        </div>
        <div><label class="label">แผนก</label><input v-model="form.department" class="input" /></div>
        <div><label class="label">ตำแหน่ง</label><input v-model="form.position" class="input" /></div>
        <div><label class="label">เงินเดือน (บาท)</label><input v-model.number="form.salary" type="number" min="0" step="0.01" class="input" required /></div>
        <div><label class="label">เบอร์โทร</label><input v-model="form.phone" type="tel" class="input" /></div>
        <div><label class="label">วันเกิด</label><input v-model="form.birthdate" type="date" class="input" /></div>
        <div><label class="label">วันเริ่มงาน</label><input v-model="form.start_date" type="date" class="input" /></div>
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
        <input v-model="newPassword" type="password" class="input" required minlength="6" autocomplete="new-password" />
      </form>
      <template #footer>
        <button type="button" class="btn-secondary" @click="resetOpen = false">ยกเลิก</button>
        <button type="submit" form="reset-form" class="btn-primary" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />ยืนยัน</button>
      </template>
    </AppModal>

    <ConfirmModal v-model="offOpen" title="ปิดการใช้งานพนักงาน" :message="`ปิดการใช้งานบัญชีของ ${selected?.name}? พนักงานจะเข้าสู่ระบบไม่ได้`" confirm-text="ปิดใช้งาน" danger :loading="busy" @confirm="deactivate" />
  </div>
</template>
