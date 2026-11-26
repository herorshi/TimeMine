<script setup>
import { apiError, dayjs, fmtDate } from '~/utils/format'

definePageMeta({ roles: ['admin'] })

const api = useApi()
const toast = useToast()
const thisYear = new Date().getFullYear()
const year = ref(thisYear)
const years = ref([thisYear + 1, thisYear, thisYear - 1])
const holidays = ref([])
const loading = ref(true)
const saving = ref(false)
const formOpen = ref(false)
const form = reactive({ id: null, date: '', name: '' })
const deleteOpen = ref(false)
const copyOpen = ref(false)
const target = ref(null)

async function load() {
  const y = year.value
  loading.value = true
  try {
    const { data } = await api.get('/holidays', { params: { year: y } })
    if (y === year.value) holidays.value = data
  } catch (e) {
    if (y === year.value) { holidays.value = []; toast.error(apiError(e)) }
  } finally {
    if (y === year.value) loading.value = false
  }
}
async function loadYears() {
  try {
    const { data } = await api.get('/holidays/years')
    years.value = [...new Set([thisYear + 1, year.value, ...data])].sort((a, b) => b - a)
  } catch (e) { toast.error(apiError(e)) }
}
watch(year, load)
onMounted(() => { load(); loadYears() })

function openForm(h) {
  Object.assign(form, h ? { id: h.id, date: h.date, name: h.name } : { id: null, date: '', name: '' })
  formOpen.value = true
}

async function save() {
  if (saving.value) return
  if (!form.date || !form.name.trim()) return toast.error('กรุณากรอกวันที่และชื่อวันหยุด')
  saving.value = true
  try {
    const payload = { date: form.date, name: form.name }
    if (form.id) await api.put(`/holidays/${form.id}`, payload)
    else await api.post('/holidays', payload)
    toast.success('บันทึกวันหยุดแล้ว')
    formOpen.value = false
    const saved = Number(payload.date.slice(0, 4))
    if (saved !== year.value) year.value = saved
    else await load()
    loadYears()
  } catch (e) { toast.error(apiError(e)) } finally { saving.value = false }
}

async function remove() {
  saving.value = true
  try {
    await api.delete(`/holidays/${target.value.id}`)
    toast.success('ลบวันหยุดแล้ว')
    deleteOpen.value = false
    await load()
  } catch (e) { toast.error(apiError(e)) } finally { saving.value = false }
}

// copies the previous year's holidays onto the same month/day; dates already taken are skipped
async function copyPrevious() {
  saving.value = true
  const y = year.value
  let added = 0
  let skipped = 0
  try {
    const { data } = await api.get('/holidays', { params: { year: y - 1 } })
    if (!data.length) return toast.warning('ปีก่อนหน้าไม่มีวันหยุดให้คัดลอก')
    for (const h of data) {
      const date = `${y}${h.date.slice(4)}`
      if (dayjs(date).format('YYYY-MM-DD') !== date) { skipped++; continue } // 29 Feb
      try { await api.post('/holidays', { date, name: h.name }); added++ } catch (e) {
        if (e.response?.status !== 409) throw e
        skipped++
      }
    }
    toast.success(`คัดลอกแล้ว ${added} วัน${skipped ? ` (ข้าม ${skipped} วัน)` : ''}`)
  } catch (e) { toast.error(apiError(e)) } finally {
    saving.value = false
    copyOpen.value = false
    await load()
  }
}
</script>

<template>
  <div>
    <PageHeader title="จัดการวันหยุด" :subtitle="`ทั้งหมด ${loading ? '-' : holidays.length} วัน`">
      <select v-model.number="year" class="input w-36" aria-label="เลือกปี" :disabled="saving">
        <option v-for="y in years" :key="y" :value="y">พ.ศ. {{ y + 543 }}</option>
      </select>
      <button class="btn-secondary" :disabled="saving || loading" @click="copyOpen = true">คัดลอกจากปีก่อน</button>
      <button class="btn-primary" @click="openForm()">+ เพิ่มวันหยุด</button>
    </PageHeader>

    <LoadingBlock v-if="loading" />
    <div v-else-if="!holidays.length" class="card"><EmptyState icon="📅" text="ยังไม่มีวันหยุดในปีนี้" /></div>
    <div v-else class="table-wrap">
      <table class="table">
        <thead><tr><th>วันที่</th><th>ชื่อวันหยุด</th><th class="!text-right">จัดการ</th></tr></thead>
        <tbody>
          <tr v-for="h in holidays" :key="h.id">
            <td class="whitespace-nowrap">{{ fmtDate(h.date) }}<span class="block text-xs text-slate-400">{{ dayjs(h.date).format('dddd') }}</span></td>
            <td class="min-w-[10rem]">{{ h.name }}</td>
            <td>
              <div class="flex justify-end gap-2">
                <button class="btn-secondary btn-sm whitespace-nowrap" @click="openForm(h)">แก้ไข</button>
                <button class="btn-danger btn-sm whitespace-nowrap" @click="target = h; deleteOpen = true">ลบ</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppModal v-model="formOpen" :title="form.id ? 'แก้ไขวันหยุด' : 'เพิ่มวันหยุด'">
      <form id="holiday-form" class="space-y-4" @submit.prevent="save">
        <div><label class="label" for="h-date">วันที่</label><input id="h-date" v-model="form.date" type="date" class="input" required></div>
        <div><label class="label" for="h-name">ชื่อวันหยุด</label><input id="h-name" v-model="form.name" class="input" required></div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="formOpen = false">ยกเลิก</button>
        <button class="btn-primary" type="submit" form="holiday-form" :disabled="saving"><Spinner v-if="saving" class="h-4 w-4" />บันทึก</button>
      </template>
    </AppModal>

    <ConfirmModal v-model="deleteOpen" title="ลบวันหยุด" :message="`ต้องการลบ “${target?.name}” (${fmtDate(target?.date)}) ใช่หรือไม่`" confirm-text="ลบ" danger :loading="saving" @confirm="remove" />
    <ConfirmModal v-model="copyOpen" title="คัดลอกจากปีก่อน" :message="`คัดลอกวันหยุดปี พ.ศ. ${year + 542} มายังปี พ.ศ. ${year + 543} (วันเดือนเดิม วันที่มีอยู่แล้วจะถูกข้าม) วันหยุดที่เลื่อนตามปฏิทินจันทรคติต้องตรวจแก้เอง`" confirm-text="คัดลอก" :loading="saving" @confirm="!saving && copyPrevious()" />
  </div>
</template>
