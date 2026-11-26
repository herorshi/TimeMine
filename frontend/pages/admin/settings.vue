<script setup>
import { apiError } from '~/utils/format'
definePageMeta({ roles: ['admin'] })

const api = useApi()
const toast = useToast()
const form = ref(null)
const loading = ref(true)
const busy = ref(false)

const fields = [
  { key: 'company_name', label: 'ชื่อบริษัท', type: 'text', wide: true },
  { key: 'work_start', label: 'เวลาเข้างาน', type: 'time' },
  { key: 'work_end', label: 'เวลาเลิกงาน', type: 'time' },
  { key: 'late_grace_min', label: 'ผ่อนผันการมาสาย (นาที)', type: 'number', min: 0, max: 240, step: 1 },
  { key: 'work_days_per_month', label: 'วันทำงานต่อเดือน', type: 'number', min: 1, max: 31, step: 'any' },
  { key: 'work_hours_per_day', label: 'ชั่วโมงทำงานต่อวัน', type: 'number', min: 1, max: 24, step: 'any' },
  { key: 'ot_multiplier', label: 'ตัวคูณค่า OT', type: 'number', min: 0, max: 10, step: 'any' },
  { key: 'face_threshold', label: 'เกณฑ์สแกนใบหน้า', type: 'number', min: 0.1, max: 1, step: 'any', hint: 'ค่ายิ่งต่ำยิ่งเข้มงวด (แนะนำ 0.5)' },
]

onMounted(async () => {
  try { form.value = (await api.get('/settings')).data } catch (e) { toast.error(apiError(e)) } finally { loading.value = false }
})

async function save() {
  busy.value = true
  try {
    form.value = (await api.put('/settings', form.value)).data
    toast.success('บันทึกการตั้งค่าแล้ว')
  } catch (e) { toast.error(apiError(e)) } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="ตั้งค่าระบบ" />
    <LoadingBlock v-if="loading" />
    <div v-else-if="!form" class="card"><EmptyState text="โหลดการตั้งค่าไม่สำเร็จ" /></div>
    <form v-else class="card max-w-3xl" @submit.prevent="save">
      <div class="grid gap-4 sm:grid-cols-2">
        <div v-for="f in fields" :key="f.key" :class="{ 'sm:col-span-2': f.wide }">
          <label class="label" :for="f.key">{{ f.label }}</label>
          <input :id="f.key" v-model="form[f.key]" :type="f.type" :min="f.min" :max="f.max" :step="f.step" class="input" required />
          <p v-if="f.hint" class="mt-1 text-xs text-slate-400">{{ f.hint }}</p>
        </div>
      </div>
      <div class="mt-5 flex justify-end">
        <button type="submit" class="btn-primary" :disabled="busy"><Spinner v-if="busy" class="h-4 w-4" />บันทึก</button>
      </div>
    </form>
  </div>
</template>
