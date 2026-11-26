<script setup>
// <FaceScanner v-model="open" title="..." @captured="(descriptor) => ..." />  descriptor = number[128]
import AppModal from '~/components/ui/AppModal.vue'
import ProgressBar from '~/components/ui/ProgressBar.vue'
import Spinner from '~/components/ui/Spinner.vue'

const open = defineModel({ type: Boolean, default: false })
defineProps({ title: { type: String, default: 'สแกนใบหน้า' } })
const emit = defineEmits(['captured'])

const { load, loading: modelLoading, progress } = useFaceApi()

const video = ref(null)
const canvas = ref(null)
const preparing = ref(false)
const scanning = ref(false)
const hasFace = ref(false)
const fatal = ref('') // camera / model error: needs retry
const scanError = ref('')

let faceapi = null
let stream = null
let timer = null
let session = 0 // bumps on every start/stop so stale async work is dropped

const detectorOptions = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })

const status = computed(() => {
  if (modelLoading.value) return 'กำลังโหลดระบบสแกนใบหน้า...'
  if (preparing.value) return 'กำลังเปิดกล้อง...'
  if (scanning.value) return 'กำลังสแกน กรุณาอยู่นิ่งๆ...'
  return hasFace.value ? 'พบใบหน้าแล้ว กดปุ่ม "สแกน"' : 'จัดใบหน้าให้อยู่ตรงกลางกล้อง'
})

function cameraError(e) {
  if (['NotAllowedError', 'SecurityError'].includes(e?.name)) return 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์แล้วลองใหม่'
  if (['NotFoundError', 'OverconstrainedError'].includes(e?.name)) return 'ไม่พบกล้องบนอุปกรณ์นี้'
  if (['NotReadableError', 'AbortError'].includes(e?.name)) return 'เปิดกล้องไม่ได้ กล้องอาจถูกใช้งานโดยแอปอื่นอยู่'
  return 'เปิดกล้องไม่สำเร็จ กรุณาลองใหม่'
}

function stop() {
  session++
  clearTimeout(timer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  if (video.value) video.value.srcObject = null
  preparing.value = false
  scanning.value = false
  hasFace.value = false
}

async function start() {
  stop()
  const mine = session
  fatal.value = ''
  scanError.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    fatal.value = 'เบราว์เซอร์นี้เปิดกล้องไม่ได้ (ต้องเข้าใช้งานผ่าน HTTPS หรือ localhost)'
    return
  }
  preparing.value = true
  try {
    faceapi = await load()
  } catch {
    if (mine !== session) return
    preparing.value = false
    fatal.value = 'โหลดระบบสแกนใบหน้าไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
    return
  }
  if (mine !== session) return
  try {
    const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false })
    if (mine !== session) return media.getTracks().forEach((t) => t.stop())
    stream = media
    await nextTick()
    video.value.srcObject = media
    await video.value.play()
  } catch (e) {
    if (mine !== session) return
    stop()
    fatal.value = cameraError(e)
    return
  }
  if (mine !== session) return
  preparing.value = false
  track(mine)
}

function drawBox(detection) {
  const c = canvas.value
  const v = video.value
  if (!c || !v) return
  c.width = v.videoWidth
  c.height = v.videoHeight
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, c.width, c.height)
  if (!detection) return
  const { x, y, width, height } = detection.box
  ctx.strokeStyle = '#10b981'
  ctx.lineWidth = Math.max(3, c.width / 160)
  ctx.strokeRect(x, y, width, height)
}

// live face-box overlay
async function track(mine) {
  if (mine !== session) return
  if (!scanning.value && video.value?.videoWidth) {
    try {
      const found = await faceapi.detectSingleFace(video.value, detectorOptions())
      if (mine !== session) return
      hasFace.value = !!found
      drawBox(found)
    } catch { /* skip this frame */ }
  }
  timer = setTimeout(() => track(mine), 250)
}

async function scan() {
  const mine = session
  scanning.value = true
  scanError.value = ''
  try {
    let result = null
    for (let i = 0; i < 3 && !result && mine === session; i++) {
      result = await faceapi.detectSingleFace(video.value, detectorOptions()).withFaceLandmarks().withFaceDescriptor()
    }
    if (mine !== session) return
    if (!result) {
      scanError.value = 'ไม่พบใบหน้า กรุณาจัดใบหน้าให้อยู่ตรงกลาง ในที่มีแสงเพียงพอ แล้วกดสแกนอีกครั้ง'
      return
    }
    const descriptor = Array.from(result.descriptor)
    open.value = false
    emit('captured', descriptor)
  } catch {
    if (mine === session) scanError.value = 'สแกนใบหน้าไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    if (mine === session) scanning.value = false
  }
}

watch(open, (v) => (v ? start() : stop()), { flush: 'post' })
onMounted(() => { if (open.value) start() })
onBeforeUnmount(stop)
</script>

<template>
  <AppModal v-model="open" :title="title" size="md">
    <div class="space-y-3">
      <div v-if="fatal" class="rounded-xl bg-rose-50 px-4 py-6 text-center text-sm text-rose-700" role="alert">{{ fatal }}</div>
      <template v-else>
        <div class="relative flex min-h-[14rem] items-center justify-center overflow-hidden rounded-xl bg-slate-900">
          <video ref="video" class="max-h-[55vh] w-full -scale-x-100 object-contain" autoplay muted playsinline />
          <canvas ref="canvas" class="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-contain" />
          <div v-if="preparing" class="absolute inset-0 flex items-center justify-center text-white"><Spinner class="h-8 w-8" /></div>
        </div>
        <ProgressBar v-if="modelLoading" :value="progress" :max="100" label="โหลดโมเดล" suffix="%" />
        <p class="text-center text-sm" :class="hasFace ? 'text-emerald-600' : 'text-slate-500'" aria-live="polite">{{ status }}</p>
        <p v-if="scanError" class="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700" role="alert">{{ scanError }}</p>
      </template>
    </div>
    <template #footer>
      <button type="button" class="btn-secondary" @click="open = false">ยกเลิก</button>
      <button v-if="fatal" type="button" class="btn-primary" @click="start">ลองใหม่</button>
      <button v-else type="button" class="btn-primary" :disabled="preparing || scanning" @click="scan"><Spinner v-if="scanning" class="h-4 w-4" />สแกน</button>
    </template>
  </AppModal>
</template>
