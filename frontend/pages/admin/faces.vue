<script setup>
import { fmtDate, apiError } from '~/utils/format'
definePageMeta({ roles: ['admin'], perm: 'employees.manage' })

const api = useApi()
const auth = useAuthStore()
const toast = useToast()

const users = ref([])
const loading = ref(true)
const busy = ref(false)
const scannerOpen = ref(false)
const linkOpen = ref(false)
const photoOpen = ref(false)
const resetOpen = ref(false)
const selected = ref(null)
const capture = ref(null) // { descriptors, photo } from the scanner, kept until linked
const tab = ref('existing')
const search = ref('')
const pickedId = ref(null)
const blank = { emp_code: '', name: '', email: '', password: '', gender: 'M', department: '', position: '', salary: 0 }
const form = reactive({ ...blank })

// only an executive can manage admin/executive accounts
const canManage = (u) => auth.isExecutive || u.role === 'employee'
const enrolled = computed(() => users.value.filter((u) => u.face_enrolled))
const candidates = computed(() => {
  const q = search.value.trim().toLowerCase()
  return users.value.filter((u) => u.active && !u.face_enrolled && canManage(u)
    && (!q || [u.emp_code, u.name, u.email, u.department].some((v) => String(v || '').toLowerCase().includes(q))))
})
const picked = computed(() => candidates.value.find((u) => u.id === pickedId.value))

const columns = [
  { key: 'photo', label: 'รูปหลักฐาน', filter: 'none', sortable: false },
  { key: 'name', label: 'พนักงาน', text: (u) => `${u.name} ${u.emp_code}` },
  { key: 'department', label: 'แผนก', filter: 'select', value: (u) => u.department || '-' },
  { key: 'face_enrolled_at', label: 'วันที่ลงทะเบียน', filter: 'date', text: (u) => fmtDate(u.face_enrolled_at), class: 'whitespace-nowrap' },
]

async function load() {
  try { users.value = (await api.get('/users')).data } catch (e) { toast.error(apiError(e)) } finally { loading.value = false }
}
onMounted(load)

function onCaptured({ descriptor, descriptors, photo }) {
  capture.value = { descriptors: descriptors?.length ? descriptors : [descriptor], photo }
  tab.value = 'existing'
  search.value = ''
  pickedId.value = null
  Object.assign(form, blank)
  linkOpen.value = true
}
const enroll = (userId) => api.post(`/face/enroll/${userId}`, capture.value)

function finish(name) {
  linkOpen.value = false
  capture.value = null
  toast.success(`ลงทะเบียนใบหน้าของ ${name} แล้ว`)
}

async function linkExisting() {
  const u = picked.value
  if (!u) return
  busy.value = true
  try {
    await enroll(u.id)
    finish(u.name)
    await load()
  } catch (e) { toast.error(apiError(e)) } finally { busy.value = false }
}

async function createAndLink() {
  busy.value = true
  let created = null
  try {
    created = (await api.post('/users', { ...form })).data
    await enroll(created.id)
    finish(created.name)
  } catch (e) {
    toast.error(created ? `เพิ่มพนักงานแล้ว แต่ผูกใบหน้าไม่สำเร็จ: ${apiError(e)}` : apiError(e))
  }
  if (created) {
    await load()
    // the account exists now: retry from the list instead of creating it twice
    if (linkOpen.value) { tab.value = 'existing'; search.value = ''; pickedId.value = created.id }
  }
  busy.value = false
}

function openPhoto(u) { selected.value = u; photoOpen.value = true }
function openReset(u) { selected.value = u; resetOpen.value = true }
async function resetFace() {
  busy.value = true
  try {
    await api.delete(`/face/enroll/${selected.value.id}`)
    resetOpen.value = false
    toast.success('รีเซ็ตใบหน้าแล้ว')
    await load()
  } catch (e) { toast.error(apiError(e)) } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="ลงทะเบียนใบหน้าพนักงาน">
      <button class="btn-primary" :disabled="loading" @click="scannerOpen = true">สแกนใบหน้าใหม่</button>
    </PageHeader>

    <DataTable :columns="columns" :rows="enrolled" :loading="loading" empty-text="ยังไม่มีพนักงานที่ลงทะเบียนใบหน้า">
      <template #cell-photo="{ row: u }">
        <button v-if="u.face_photo_url" type="button" :aria-label="`ดูรูปใบหน้าของ ${u.name}`" @click="openPhoto(u)">
          <img :src="u.face_photo_url" alt="" class="h-12 w-12 min-w-[3rem] rounded-lg border border-slate-200 object-cover" />
        </button>
        <span v-else class="text-slate-400">-</span>
      </template>
      <template #cell-name="{ row: u }">
        <p class="font-medium">{{ u.name }}</p>
        <p class="text-xs text-slate-400">{{ u.emp_code }}</p>
      </template>
      <template #actions="{ row: u }">
        <button v-if="canManage(u)" class="btn-secondary btn-sm" @click="openReset(u)">รีเซ็ตใบหน้า</button>
        <span v-else class="text-slate-400">-</span>
      </template>
    </DataTable>

    <FaceScanner v-model="scannerOpen" title="สแกนใบหน้าใหม่" :samples="3" @captured="onCaptured" />

    <AppModal v-model="linkOpen" title="ผูกกับบัญชี" size="lg" persistent>
      <div class="mb-4 flex items-center gap-3">
        <img v-if="capture?.photo" :src="capture.photo" alt="รูปที่สแกนได้" class="h-20 w-20 rounded-xl object-cover" />
        <p class="text-sm text-slate-600">สแกนใบหน้าแล้ว เลือกบัญชีที่ต้องการผูก รูปนี้จะถูกบันทึกเป็นหลักฐาน</p>
      </div>
      <div class="mb-4 flex gap-2">
        <button type="button" class="btn-sm" :class="tab === 'existing' ? 'btn-primary' : 'btn-secondary'" :disabled="busy" @click="tab = 'existing'">พนักงานที่มีอยู่</button>
        <button type="button" class="btn-sm" :class="tab === 'new' ? 'btn-primary' : 'btn-secondary'" :disabled="busy" @click="tab = 'new'">เพิ่มพนักงานใหม่</button>
      </div>

      <div v-if="tab === 'existing'">
        <input v-model="search" type="search" class="input mb-2" placeholder="ค้นหา รหัส ชื่อ อีเมล แผนก" />
        <EmptyState v-if="!candidates.length" text="ไม่พบพนักงานที่ยังไม่ได้ลงทะเบียนใบหน้า" />
        <ul v-else class="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          <li v-for="u in candidates" :key="u.id">
            <label class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
              <input v-model="pickedId" type="radio" name="face-user" :value="u.id" />
              <span class="min-w-0">
                <span class="block break-words text-sm font-medium">{{ u.name }}</span>
                <span class="block text-xs text-slate-400">{{ u.emp_code }} · {{ u.department || '-' }}</span>
              </span>
            </label>
          </li>
        </ul>
      </div>

      <form v-else id="face-new-form" class="grid gap-3 sm:grid-cols-2" @submit.prevent="createAndLink">
        <div><label class="label">รหัสพนักงาน</label><input v-model="form.emp_code" class="input" required /></div>
        <div><label class="label">ชื่อ-นามสกุล</label><input v-model="form.name" class="input" required /></div>
        <div><label class="label">อีเมล</label><input v-model="form.email" type="email" class="input" required autocomplete="off" /></div>
        <div><label class="label">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label><PasswordInput v-model="form.password" required minlength="6" autocomplete="new-password" /></div>
        <div><label class="label">เพศ</label><select v-model="form.gender" class="input"><option value="M">ชาย</option><option value="F">หญิง</option></select></div>
        <div><label class="label">แผนก</label><input v-model="form.department" class="input" /></div>
        <div><label class="label">ตำแหน่ง</label><input v-model="form.position" class="input" /></div>
        <div><label class="label">เงินเดือน (บาท)</label><input v-model.number="form.salary" type="number" min="0" step="0.01" class="input" required /></div>
      </form>

      <template #footer>
        <button type="button" class="btn-secondary" :disabled="busy" @click="linkOpen = false">ยกเลิก</button>
        <button v-if="tab === 'existing'" type="button" class="btn-primary" :disabled="busy || !picked" @click="linkExisting"><Spinner v-if="busy" class="h-4 w-4" />ผูกใบหน้า</button>
        <button v-else type="submit" form="face-new-form" class="btn-primary" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />เพิ่มพนักงานและผูกใบหน้า</button>
      </template>
    </AppModal>

    <AppModal v-model="photoOpen" title="รูปหลักฐานการลงทะเบียนใบหน้า">
      <img :src="selected?.face_photo_url" :alt="`รูปใบหน้าของ ${selected?.name}`" class="mx-auto max-h-[60vh] rounded-xl" />
      <p class="mt-3 text-center text-sm text-slate-600">{{ selected?.name }} · ลงทะเบียน {{ fmtDate(selected?.face_enrolled_at) }}</p>
    </AppModal>

    <ConfirmModal v-model="resetOpen" title="รีเซ็ตใบหน้า" :message="`รีเซ็ตข้อมูลใบหน้าของ ${selected?.name}? ต้องสแกนลงทะเบียนใหม่ก่อนจึงจะใช้สแกนใบหน้าได้`" confirm-text="รีเซ็ต" danger :loading="busy" @confirm="resetFace" />
  </div>
</template>
