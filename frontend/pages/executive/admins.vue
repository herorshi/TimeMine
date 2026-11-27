<script setup>
import { ROLE_LABELS } from '~/utils/constants'
import { fmtMoney, apiError } from '~/utils/format'
definePageMeta({ roles: ['executive'] })

const api = useApi()
const auth = useAuthStore()
const toast = useToast()

const users = ref([])
const loading = ref(true)
const busy = ref(false)
const formOpen = ref(false)
const delOpen = ref(false)
const selected = ref(null) // null = creating
const blank = { emp_code: '', name: '', email: '', password: '', gender: 'M', department: '', position: '', salary: 0, role: 'admin' }
const form = reactive({ ...blank })
const roleOptions = ['admin', 'executive']

const admins = computed(() => users.value.filter((u) => roleOptions.includes(u.role)))
const isSelf = (u) => u?.id === auth.user?.id
const genderLabel = (u) => (u.gender === 'M' ? 'ชาย' : 'หญิง')

const columns = [
  { key: 'name', label: 'ชื่อ', text: (u) => `${u.name} ${u.email} ${u.emp_code}` },
  { key: 'gender', label: 'เพศ', filter: 'select', text: genderLabel, class: 'whitespace-nowrap' },
  { key: 'department', label: 'แผนก', filter: 'select', value: (u) => u.department || '-' },
  { key: 'position', label: 'ตำแหน่ง', value: (u) => u.position || '-' },
  { key: 'role', label: 'สิทธิ์', filter: 'select', text: (u) => ROLE_LABELS[u.role] },
  { key: 'active', label: 'สถานะ', filter: 'select', value: (u) => (u.active ? 1 : 0), text: (u) => (u.active ? 'ใช้งาน' : 'ปิดใช้งาน') },
  { key: 'salary', label: 'เงินเดือน', value: (u) => Number(u.salary || 0), text: (u) => fmtMoney(u.salary), class: 'whitespace-nowrap' },
]

async function load() {
  try { users.value = (await api.get('/users')).data } catch (e) { toast.error(apiError(e)) } finally { loading.value = false }
}
onMounted(load)

function openForm(u = null) {
  selected.value = u
  for (const k of Object.keys(blank)) form[k] = u ? u[k] ?? blank[k] : blank[k]
  formOpen.value = true
}
function openDelete(u) { selected.value = u; delOpen.value = true }

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
  run(() => (u ? api.put(`/users/${u.id}`, data) : api.post('/users', { ...data, password })), formOpen, u ? 'บันทึกข้อมูลแล้ว' : 'เพิ่มบัญชีแล้ว')
}
const remove = () => run(() => api.delete(`/users/${selected.value.id}/permanent`), delOpen, 'ลบบัญชีแล้ว')
</script>

<template>
  <div>
    <PageHeader title="จัดการผู้ดูแลระบบ" subtitle="บัญชี Admin และผู้บริหาร">
      <button class="btn-primary" @click="openForm()">+ เพิ่มบัญชี</button>
    </PageHeader>

    <DataTable :columns="columns" :rows="admins" :loading="loading" empty-text="ไม่พบบัญชี" :row-class="(u) => (u.active ? '' : 'opacity-60')">
      <template #cell-name="{ row }">
        <div class="min-w-[12rem]">
          <p class="font-medium">{{ row.name }}</p>
          <p class="break-all text-xs text-slate-400">{{ row.email }}</p>
          <p class="text-xs text-slate-400">{{ row.emp_code }}</p>
        </div>
      </template>
      <template #cell-role="{ row }"><StatusBadge :color="row.role === 'executive' ? 'violet' : 'sky'" :label="ROLE_LABELS[row.role]" /></template>
      <template #cell-active="{ row }"><StatusBadge :color="row.active ? 'emerald' : 'rose'" :label="row.active ? 'ใช้งาน' : 'ปิดใช้งาน'" /></template>
      <template #actions="{ row }">
        <div class="flex justify-end gap-2">
          <button class="btn-secondary btn-sm" @click="openForm(row)">แก้ไข</button>
          <button v-if="!isSelf(row)" class="btn-danger btn-sm" @click="openDelete(row)">ลบ</button>
        </div>
      </template>
    </DataTable>

    <AppModal v-model="formOpen" :title="selected ? 'แก้ไขบัญชี' : 'เพิ่มบัญชี'" size="lg">
      <form id="admin-form" class="grid gap-3 sm:grid-cols-2" @submit.prevent="save">
        <div><label class="label">รหัสพนักงาน</label><input v-model="form.emp_code" class="input" required /></div>
        <div><label class="label">ชื่อ-นามสกุล</label><input v-model="form.name" class="input" required /></div>
        <div><label class="label">อีเมล</label><input v-model="form.email" type="email" class="input" required autocomplete="off" /></div>
        <div v-if="!selected"><label class="label">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label><PasswordInput v-model="form.password" required minlength="6" autocomplete="new-password"  /></div>
        <div><label class="label">เพศ</label><select v-model="form.gender" class="input"><option value="M">ชาย</option><option value="F">หญิง</option></select></div>
        <div><label class="label">แผนก</label><input v-model="form.department" class="input" /></div>
        <div><label class="label">ตำแหน่ง</label><input v-model="form.position" class="input" /></div>
        <div><label class="label">เงินเดือน (บาท)</label><input v-model.number="form.salary" type="number" min="0" step="0.01" class="input" required /></div>
        <div>
          <label class="label">สิทธิ์การใช้งาน</label>
          <select v-model="form.role" class="input" :disabled="isSelf(selected)"><option v-for="k in roleOptions" :key="k" :value="k">{{ ROLE_LABELS[k] }}</option></select>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-secondary" @click="formOpen = false">ยกเลิก</button>
        <button type="submit" form="admin-form" class="btn-primary" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />บันทึก</button>
      </template>
    </AppModal>

    <ConfirmModal v-model="delOpen" title="ลบบัญชีถาวร" :message="`ลบบัญชีของ ${selected?.name} และข้อมูลการเข้างาน การลา OT และใบเตือนของบัญชีนี้อย่างถาวร? ไม่สามารถกู้คืนได้`" confirm-text="ลบถาวร" danger :loading="busy" @confirm="remove" />
  </div>
</template>
