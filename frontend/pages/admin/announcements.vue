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

const typeLabel = (type) => (type === 'event' ? 'กิจกรรม' : 'ข่าว')
// value/text mirror what each cell shows, so the column filters and sorting match the screen
const columns = [
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
  formOpen.value = true
}

async function save() {
  if (saving.value) return
  if (!form.title.trim() || !form.body.trim()) return toast.error('กรุณากรอกหัวข้อและรายละเอียด')
  if (form.type === 'event' && !form.event_date) return toast.error('กรุณาระบุวันที่จัดกิจกรรม')
  saving.value = true
  try {
    const { id, ...payload } = form
    if (id) await api.put(`/announcements/${id}`, payload)
    else await api.post('/announcements', payload)
    toast.success('บันทึกประกาศแล้ว')
    formOpen.value = false
    await load()
  } catch (e) { toast.error(apiError(e)) } finally { saving.value = false }
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
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="a-type">ประเภท</label>
            <select id="a-type" v-model="form.type" class="input"><option value="news">ข่าว</option><option value="event">กิจกรรม</option></select>
          </div>
          <div v-if="form.type === 'event'"><label class="label" for="a-date">วันที่จัดกิจกรรม</label><input id="a-date" v-model="form.event_date" type="date" class="input" required></div>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="form.pinned" type="checkbox" class="h-4 w-4 rounded">ปักหมุดไว้ด้านบน</label>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="formOpen = false">ยกเลิก</button>
        <button class="btn-primary" type="submit" form="announcement-form" :disabled="saving"><Spinner v-if="saving" class="h-4 w-4" />บันทึก</button>
      </template>
    </AppModal>

    <ConfirmModal v-model="deleteOpen" title="ลบประกาศ" :message="`ต้องการลบ “${target?.title}” ใช่หรือไม่`" confirm-text="ลบ" danger :loading="saving" @confirm="remove" />
  </div>
</template>
