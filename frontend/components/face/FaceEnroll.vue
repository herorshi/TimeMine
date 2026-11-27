<script setup>
// Admin side. With a user:  <FaceEnroll :user-id="u.id" :user-name="u.name" @changed="(enrolled) => ..." />  (enrolls via the API)
// Scan first, link later:    <FaceEnroll @captured="({ descriptor, descriptors, photo }) => ..." />        (no API call)
// Employees cannot self-enroll; they only see their status on /profile and /checkin.
import Spinner from '~/components/ui/Spinner.vue'
import { apiError, fmtDateTime } from '~/utils/format'

const props = defineProps({
  userId: { type: [Number, String], default: null },
  userName: { type: String, default: '' },
})
const emit = defineEmits(['changed', 'captured'])
const api = useApi()
const toast = useToast()

const saving = ref(false)
const scannerOpen = ref(false)
const result = ref(null) // { photo_url, enrolled_at }; scan-only: { photo_url }
const error = ref('')

watch(() => props.userId, () => { result.value = null; error.value = '' })

function openScanner() {
  error.value = ''
  scannerOpen.value = true
}

async function enroll({ descriptor, descriptors, photo }) {
  const userId = props.userId
  if (userId === null) {
    result.value = { photo_url: photo }
    emit('captured', { descriptor, descriptors, photo })
    return
  }
  saving.value = true
  try {
    const { data } = await api.post(`/face/enroll/${userId}`, { descriptors, photo })
    if (userId === props.userId) result.value = data
    toast.success('ลงทะเบียนใบหน้าแล้ว')
    emit('changed', true)
  } catch (e) {
    error.value = apiError(e)
    toast.error(error.value)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <p class="break-words font-semibold text-slate-800">ลงทะเบียนใบหน้า{{ userName ? `: ${userName}` : '' }}</p>
    <div v-if="result" class="space-y-2">
      <img v-if="result.photo_url" :src="result.photo_url" alt="รูปใบหน้าที่บันทึกเป็นหลักฐาน" class="max-h-64 w-full rounded-xl bg-slate-100 object-contain" />
      <p v-if="result.enrolled_at" class="text-sm text-emerald-700">ลงทะเบียนแล้วเมื่อ {{ fmtDateTime(result.enrolled_at) }}</p>
      <template v-else>
        <p class="text-sm text-emerald-700">สแกนใบหน้าเรียบร้อย ขั้นต่อไปเชื่อมกับบัญชีพนักงาน</p>
        <button type="button" class="btn-secondary" @click="openScanner">สแกนใหม่</button>
      </template>
    </div>
    <template v-else>
      <p class="text-sm text-slate-500">ระบบจะสแกนใบหน้าพนักงาน 3 ภาพ และบันทึกใบหน้าเป็นหลักฐาน ให้พนักงานอยู่หน้ากล้องในที่มีแสงเพียงพอ</p>
      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
      <button type="button" class="btn-primary" :disabled="saving" @click="openScanner">
        <Spinner v-if="saving" class="h-4 w-4" />สแกนใบหน้า
      </button>
    </template>
    <FaceScanner v-model="scannerOpen" :title="`สแกนใบหน้า ${userName}`" :samples="3" @captured="enroll" />
  </div>
</template>
