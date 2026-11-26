<script setup>
import { apiError, fmtDate, fmtDateTime } from '~/utils/format'

definePageMeta({ roles: ['admin'] })

const api = useApi()
const toast = useToast()
const items = ref([])
const loading = ref(true)
const saving = ref(false)
const pinning = ref(null)
const formOpen = ref(false)
const deleteOpen = ref(false)
const target = ref(null)
const blank = { id: null, title: '', body: '', type: 'news', event_date: '', pinned: false }
const form = reactive({ ...blank })
// image: current = stored URL, picked = resized data URL waiting to be uploaded on save
const image = reactive({ current: '', picked: '', removed: false })
const preview = computed(() => image.picked || (image.removed ? '' : image.current))
const processing = ref(false)
const uploading = ref(false)
const progress = ref(0)
const fileInput = ref(null)
const MAX_SIDE = 1600
const MAX_BYTES = 1_500_000
let pickId = 0 // a newer pick or a reopened form discards an older resize

const typeLabel = (type) => (type === 'event' ? 'กิจกรรม' : 'ข่าว')
// value/text mirror what each cell shows, so the column filters and sorting match the screen
const columns = [
  { key: 'image_url', label: 'รูปภาพ', filter: 'none', sortable: false },
  { key: 'title', label: 'หัวข้อ', class: 'min-w-[12rem] max-w-xs break-words font-medium text-slate-800' },
  { key: 'type', label: 'ประเภท', filter: 'select', options: [{ value: 'news', label: 'ข่าว' }, { value: 'event', label: 'กิจกรรม' }], text: (a) => typeLabel(a.type) },
  { key: 'event_date', label: 'วันกิจกรรม', filter: 'date', text: (a) => fmtDate(a.event_date), class: 'whitespace-nowrap' },
  { key: 'created_at', label: 'สร้างเมื่อ', filter: 'date', text: (a) => fmtDateTime(a.created_at), class: 'whitespace-nowrap text-slate-500' },
]

async function load() {
  try {
    items.value = (await api.get('/announcements')).data
  } catch (e) { toast.error(apiError(e)) } finally { loading.value = false }
}
onMounted(load)

function openForm(a) {
  Object.assign(form, blank, a ? { id: a.id, title: a.title, body: a.body, type: a.type, event_date: a.event_date || '', pinned: !!a.pinned } : {})
  pickId++
  Object.assign(image, { current: a?.image_url || '', picked: '', removed: false })
  processing.value = false
  progress.value = 0
  formOpen.value = true
}

async function resizeImage(file) {
  const src = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = src
    await img.decode()
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const webp = canvas.toDataURL('image/webp', 0.82)
    if (webp.startsWith('data:image/webp')) return webp
    // no WebP encoder (Safari): JPEG has no alpha, so paint white behind the picture
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally { URL.revokeObjectURL(src) }
}

async function pickImage(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // allow picking the same file again
  if (!file) return
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return toast.error('รองรับเฉพาะรูปภาพ JPEG, PNG, WebP หรือ GIF')
  const id = ++pickId
  processing.value = true
  try {
    const dataUrl = await resizeImage(file)
    if (id !== pickId) return
    if (((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4 > MAX_BYTES) return toast.error('รูปภาพมีขนาดใหญ่เกินไป กรุณาเลือกรูปอื่น')
    image.picked = dataUrl
    image.removed = false
  } catch {
    if (id === pickId) toast.error('ไม่สามารถอ่านไฟล์รูปภาพได้')
  } finally {
    if (id === pickId) processing.value = false
  }
}

function removeImage() {
  image.picked = ''
  image.removed = true
}

async function save() {
  if (saving.value || processing.value) return
  if (!form.title.trim() || !form.body.trim()) return toast.error('กรุณากรอกหัวข้อและรายละเอียด')
  if (form.type === 'event' && !form.event_date) return toast.error('กรุณาระบุวันที่จัดกิจกรรม')
  saving.value = true
  try {
    const { id, ...payload } = form
    if (image.picked) {
      uploading.value = true
      progress.value = 0
      const { data } = await api.post('/announcements/image', { dataUrl: image.picked }, {
        onUploadProgress: (p) => { if (p.total) progress.value = Math.round((p.loaded / p.total) * 100) },
      })
      uploading.value = false
      payload.image_url = data.url
    } else if (image.removed) payload.remove_image = true
    if (id) await api.put(`/announcements/${id}`, payload)
    else await api.post('/announcements', payload)
    toast.success('บันทึกประกาศแล้ว')
    formOpen.value = false
    await load()
  } catch (e) { toast.error(apiError(e)) } finally { saving.value = false; uploading.value = false }
}

async function togglePin(a) {
  pinning.value = a.id
  try {
    await api.put(`/announcements/${a.id}`, { pinned: !a.pinned })
    toast.success(a.pinned ? 'เลิกปักหมุดแล้ว' : 'ปักหมุดแล้ว')
    await load()
  } catch (e) { toast.error(apiError(e)) } finally { pinning.value = null }
}

async function remove() {
  saving.value = true
  try {
    await api.delete(`/announcements/${target.value.id}`)
    toast.success('ลบประกาศแล้ว')
    deleteOpen.value = false
    await load()
  } catch (e) { toast.error(apiError(e)) } finally { saving.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="จัดการประกาศ">
      <button class="btn-primary" @click="openForm()">+ สร้างประกาศ</button>
    </PageHeader>

    <DataTable :columns="columns" :rows="items" row-key="id" :loading="loading" empty-text="ยังไม่มีประกาศ">
      <template #cell-image_url="{ row }">
        <img v-if="row.image_url" :src="row.image_url" :alt="`รูปประกอบ ${row.title}`" loading="lazy" class="h-10 w-16 min-w-[4rem] rounded-md bg-slate-100 object-cover">
        <span v-else class="text-slate-400">-</span>
      </template>
      <template #cell-title="{ row }"><span v-if="row.pinned" title="ปักหมุด">📌 </span>{{ row.title }}</template>
      <template #cell-type="{ row }"><StatusBadge :label="typeLabel(row.type)" :color="row.type === 'event' ? 'violet' : 'sky'" /></template>
      <template #actions="{ row }">
        <div class="flex justify-end gap-2">
          <button class="btn-secondary btn-sm whitespace-nowrap" :disabled="pinning !== null" @click="togglePin(row)"><Spinner v-if="pinning === row.id" class="h-3 w-3" />{{ row.pinned ? 'เลิกปักหมุด' : 'ปักหมุด' }}</button>
          <button class="btn-secondary btn-sm whitespace-nowrap" @click="openForm(row)">แก้ไข</button>
          <button class="btn-danger btn-sm whitespace-nowrap" @click="target = row; deleteOpen = true">ลบ</button>
        </div>
      </template>
    </DataTable>

    <AppModal v-model="formOpen" :title="form.id ? 'แก้ไขประกาศ' : 'สร้างประกาศ'" size="lg">
      <form id="announcement-form" class="space-y-4" @submit.prevent="save">
        <div><label class="label" for="a-title">หัวข้อ</label><input id="a-title" v-model="form.title" class="input" required></div>
        <div><label class="label" for="a-body">รายละเอียด</label><textarea id="a-body" v-model="form.body" class="input" rows="6" required /></div>
        <div>
          <label class="label" for="a-image">รูปภาพประกอบ</label>
          <div v-if="preview" class="mb-2 aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
            <img :src="preview" alt="ตัวอย่างรูปภาพ" class="h-full w-full object-contain">
          </div>
          <input id="a-image" ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="pickImage">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn-secondary btn-sm" :disabled="processing || saving" @click="fileInput.click()"><Spinner v-if="processing" class="h-3 w-3" />{{ processing ? 'กำลังเตรียมรูป…' : preview ? 'เปลี่ยนรูป' : 'เลือกรูปภาพ' }}</button>
            <button v-if="preview" type="button" class="btn-danger btn-sm" :disabled="processing || saving" @click="removeImage">ลบรูป</button>
          </div>
          <div v-if="uploading" class="mt-2" role="status">
            <p class="mb-1 text-xs text-slate-500">กำลังอัปโหลดรูปภาพ… {{ progress }}%</p>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full bg-brand-600 transition-all" :style="{ width: `${progress}%` }" /></div>
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="a-type">ประเภท</label>
            <select id="a-type" v-model="form.type" class="input"><option value="news">ข่าว</option><option value="event">กิจกรรม</option></select>
          </div>
          <div v-if="form.type === 'event'"><label class="label">วันที่จัดกิจกรรม</label><DateInput v-model="form.event_date" required /></div>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="form.pinned" type="checkbox" class="h-4 w-4 rounded">ปักหมุดไว้ด้านบน</label>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="formOpen = false">ยกเลิก</button>
        <button class="btn-primary" type="submit" form="announcement-form" :disabled="saving || processing"><Spinner v-if="saving" class="h-4 w-4" />บันทึก</button>
      </template>
    </AppModal>

    <ConfirmModal v-model="deleteOpen" title="ลบประกาศ" :message="`ต้องการลบ “${target?.title}” ใช่หรือไม่`" confirm-text="ลบ" danger :loading="saving" @confirm="remove" />
  </div>
</template>
