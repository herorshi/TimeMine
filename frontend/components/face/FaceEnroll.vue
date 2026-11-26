<script setup>
// <FaceEnroll @changed="(enrolled) => ..." />  self-contained card (used by the Profile page)
import ConfirmModal from '~/components/ui/ConfirmModal.vue'
import LoadingBlock from '~/components/ui/LoadingBlock.vue'
import Spinner from '~/components/ui/Spinner.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import { apiError } from '~/utils/format'

const emit = defineEmits(['changed'])
const api = useApi()
const toast = useToast()

const enrolled = ref(false)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const removing = ref(false)
const scannerOpen = ref(false)
const confirmOpen = ref(false)

async function fetchStatus() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/face/status')
    enrolled.value = data.enrolled
  } catch (e) {
    loadError.value = apiError(e)
  } finally {
    loading.value = false
  }
}

async function enroll(descriptor) {
  saving.value = true
  try {
    await api.post('/face/enroll', { descriptor })
    enrolled.value = true
    toast.success('ลงทะเบียนใบหน้าแล้ว')
    emit('changed', true)
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    saving.value = false
  }
}

async function remove() {
  removing.value = true
  try {
    await api.delete('/face/enroll')
    enrolled.value = false
    confirmOpen.value = false
    toast.success('ลบข้อมูลใบหน้าแล้ว')
    emit('changed', false)
  } catch (e) {
    toast.error(apiError(e))
  } finally {
    removing.value = false
  }
}

onMounted(fetchStatus)
</script>

<template>
  <div class="card">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-slate-800">ใบหน้าสำหรับสแกนเข้างาน</h2>
      <StatusBadge v-if="!loading && !loadError" :label="enrolled ? 'ลงทะเบียนแล้ว' : 'ยังไม่ได้ลงทะเบียน'" :color="enrolled ? 'emerald' : 'amber'" />
    </div>
    <LoadingBlock v-if="loading" />
    <div v-else-if="loadError" class="mt-3 space-y-3">
      <p class="text-sm text-rose-600">{{ loadError }}</p>
      <button type="button" class="btn-secondary" @click="fetchStatus">ลองใหม่</button>
    </div>
    <template v-else>
      <p class="mt-2 text-sm text-slate-500">{{ enrolled ? 'ใช้สแกนใบหน้าเพื่อยืนยันตัวตนตอนเข้างานได้แล้ว' : 'ลงทะเบียนใบหน้าก่อน เพื่อใช้สแกนตอนเข้างาน' }}</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="btn-primary" :disabled="saving || removing" @click="scannerOpen = true">
          <Spinner v-if="saving" class="h-4 w-4" />{{ enrolled ? 'ลงทะเบียนใหม่' : 'ลงทะเบียนใบหน้า' }}
        </button>
        <button v-if="enrolled" type="button" class="btn-secondary" :disabled="saving || removing" @click="confirmOpen = true">ลบข้อมูลใบหน้า</button>
      </div>
    </template>
    <FaceScanner v-model="scannerOpen" title="ลงทะเบียนใบหน้า" :samples="3" @captured="enroll" />
    <ConfirmModal v-model="confirmOpen" title="ลบข้อมูลใบหน้า" message="ต้องการลบข้อมูลใบหน้าที่ลงทะเบียนไว้หรือไม่" confirm-text="ลบ" danger :loading="removing" @confirm="remove" />
  </div>
</template>
