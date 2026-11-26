<script setup>
// <FaceScanner v-model="open" title="..." @captured="(descriptor) => ..." />  descriptor = number[128]
import AppModal from '~/components/ui/AppModal.vue'
import ProgressBar from '~/components/ui/ProgressBar.vue'
import Spinner from '~/components/ui/Spinner.vue'

const open = defineModel({ type: Boolean, default: false })
// samples > 1 (enrollment): average that many descriptors
const props = defineProps({ title: { type: String, default: 'สแกนใบหน้า' }, samples: { type: Number, default: 1 } })
const emit = defineEmits(['captured'])

const { load, progress } = useFaceApi()

// counted only after permission is granted: the permission prompt may stay open as long as the user likes
const VIDEO_TIMEOUT_MS = 30000
const CAMERA_ERROR = 'ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง หรือใช้อุปกรณ์ที่มีกล้อง'
const MODEL_ERROR = 'โหลดระบบสแกนใบหน้าไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
const STEADY_MS = 1000
const RETRY_DELAY_MS = 3000 // pause auto-capture after a failed scan

const video = ref(null)
const canvas = ref(null)
const cameraState = ref('permission') // permission | starting | live
const modelState = ref('loading') // loading | ready | error
const scanning = ref(false)
const hasFace = ref(false)
const fatal = ref('') // camera error: needs retry
const scanError = ref('')
const ready = computed(() => cameraState.value === 'live' && modelState.value === 'ready')

let faceapi = null
let stream = null
let timer = null
let videoTimer = null
let session = 0 // bumps on every start/stop so stale async work is dropped
let steady = null // { box, since }
let autoAfter = 0

const detectorOptions = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })

const status = computed(() => {
  if (cameraState.value === 'permission') return 'กรุณากดอนุญาตการใช้กล้อง'
  if (cameraState.value === 'starting') return 'กำลังเปิดกล้อง...'
  if (modelState.value === 'loading') return 'กำลังโหลดระบบสแกนใบหน้า...'
  if (modelState.value === 'error') return ''
  if (scanning.value) return 'กำลังสแกน กรุณาอยู่นิ่งๆ...'
  return hasFace.value ? 'พบใบหน้าแล้ว อยู่นิ่งๆ ระบบจะสแกนอัตโนมัติ หรือกดปุ่ม "สแกน"' : 'จัดใบหน้าให้อยู่ตรงกลางกล้อง'
})

function cameraError(e) {
  if (['NotAllowedError', 'SecurityError'].includes(e?.name)) return 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์แล้วลองใหม่'
  if (['NotFoundError', 'OverconstrainedError'].includes(e?.name)) return 'ไม่พบกล้องบนอุปกรณ์นี้'
  if (['NotReadableError', 'AbortError'].includes(e?.name)) return 'เปิดกล้องไม่ได้ กล้องอาจถูกใช้งานโดยแอปอื่นอยู่'
  return CAMERA_ERROR
}

function failCamera(message) {
  stop()
  fatal.value = message
}

function startVideoTimer(mine) {
  if (mine !== session || videoTimer || cameraState.value === 'live') return
  cameraState.value = 'starting'
  videoTimer = setTimeout(() => {
    if (mine === session) failCamera('กล้องไม่ตอบสนอง กรุณาปิดแอปอื่นที่ใช้กล้องแล้วลองใหม่')
  }, VIDEO_TIMEOUT_MS)
}

// not supported everywhere (older Safari / Firefox): then we only learn about the grant when getUserMedia resolves
async function watchPermission(mine) {
  try {
    const permission = await navigator.permissions.query({ name: 'camera' })
    if (mine !== session) return
    const check = () => { if (permission.state === 'granted') startVideoTimer(mine) }
    check()
    permission.onchange = check
  } catch { /* unsupported */ }
}

function metadata(el) {
  if (el.readyState >= 1) return Promise.resolve()
  return new Promise((resolve) => el.addEventListener('loadedmetadata', resolve, { once: true }))
}

async function startCamera(mine) {
  if (!navigator.mediaDevices?.getUserMedia) return failCamera(`${CAMERA_ERROR} (ต้องเข้าใช้งานผ่าน HTTPS หรือ localhost)`)
  watchPermission(mine)
  try {
    const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false })
    // closed or retried while waiting: release the late stream
    if (mine !== session) return media.getTracks().forEach((t) => t.stop())
    stream = media
    startVideoTimer(mine)
    await nextTick()
    if (mine !== session) return
    const el = video.value
    el.muted = true // iOS Safari checks the property, not just the attribute
    el.srcObject = media
    await metadata(el)
    if (mine !== session) return
    await el.play()
    if (mine !== session) return
    clearTimeout(videoTimer)
    cameraState.value = 'live'
  } catch (e) {
    if (mine === session) failCamera(cameraError(e))
  }
}

async function loadModels(mine) {
  modelState.value = 'loading'
  try {
    const lib = await load()
    if (mine !== session) return
    faceapi = lib
    modelState.value = 'ready'
  } catch {
    if (mine === session) modelState.value = 'error'
  }
}

const retryModels = () => loadModels(session)

function stop() {
  session++
  clearTimeout(timer)
  clearTimeout(videoTimer)
  videoTimer = null
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  if (video.value) video.value.srcObject = null
  cameraState.value = 'permission'
  scanning.value = false
  hasFace.value = false
  steady = null
  autoAfter = 0
  drawBox(null)
}

function start() {
  stop()
  const mine = session
  fatal.value = ''
  scanError.value = ''
  loadModels(mine)
  startCamera(mine)
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

// true once the same face has barely moved for STEADY_MS
function isSteady(box) {
  if (!box) {
    steady = null
    return false
  }
  const limit = steady && steady.box.width * 0.15
  const moved = !steady || Math.abs(box.x - steady.box.x) > limit || Math.abs(box.y - steady.box.y) > limit || Math.abs(box.width - steady.box.width) > limit
  if (moved) steady = { box, since: Date.now() }
  return Date.now() - steady.since >= STEADY_MS
}

// live face-box overlay + auto-capture
async function track(mine) {
  if (mine !== session) return
  if (ready.value && !scanning.value && video.value?.videoWidth) {
    try {
      const found = await faceapi.detectSingleFace(video.value, detectorOptions())
      if (mine !== session) return
      hasFace.value = !!found
      drawBox(found)
      if (!scanning.value && Date.now() >= autoAfter && isSteady(found?.box)) scan()
    } catch { /* skip this frame */ }
  }
  timer = setTimeout(() => track(mine), 200)
}

async function scan() {
  if (scanning.value || !ready.value) return
  const mine = session
  scanning.value = true
  scanError.value = ''
  steady = null
  try {
    const found = []
    for (let i = 0; i < props.samples * 3 && found.length < props.samples && mine === session; i++) {
      const result = await faceapi.detectSingleFace(video.value, detectorOptions()).withFaceLandmarks().withFaceDescriptor()
      if (result) found.push(result.descriptor)
      if (props.samples > 1) await new Promise((resolve) => setTimeout(resolve, 150))
    }
    if (mine !== session) return
    if (found.length < props.samples) {
      scanError.value = 'ไม่พบใบหน้า กรุณาจัดใบหน้าให้อยู่ตรงกลาง ในที่มีแสงเพียงพอ แล้วลองอีกครั้ง'
      return
    }
    const descriptor = Array.from(found[0], (_, k) => found.reduce((sum, d) => sum + d[k], 0) / found.length)
    stop() // no second capture while the modal closes
    open.value = false
    emit('captured', descriptor)
  } catch {
    if (mine === session) scanError.value = 'สแกนใบหน้าไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    if (mine === session) {
      scanning.value = false
      autoAfter = Date.now() + RETRY_DELAY_MS
    }
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
      <div v-show="!fatal" class="space-y-3">
        <div class="relative flex min-h-[14rem] items-center justify-center overflow-hidden rounded-xl bg-slate-900">
          <video ref="video" class="max-h-[55vh] w-full -scale-x-100 object-contain" autoplay muted playsinline />
          <canvas ref="canvas" class="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-contain" />
          <div v-if="cameraState !== 'live'" class="absolute inset-0 flex items-center justify-center text-white"><Spinner class="h-8 w-8" /></div>
        </div>
        <ProgressBar v-if="modelState === 'loading'" :value="progress" :max="100" label="โหลดโมเดล" suffix="%" />
        <div v-if="modelState === 'error'" class="rounded-xl bg-rose-50 px-3 py-3 text-center text-sm text-rose-700" role="alert">
          <p>{{ MODEL_ERROR }}</p>
          <button type="button" class="btn-secondary mt-2" @click="retryModels">โหลดใหม่</button>
        </div>
        <p v-if="status" class="text-center text-sm" :class="hasFace ? 'text-emerald-600' : 'text-slate-500'" aria-live="polite">{{ status }}</p>
        <p v-if="scanError" class="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700" role="alert">{{ scanError }}</p>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn-secondary" @click="open = false">ยกเลิก</button>
      <button v-if="fatal" type="button" class="btn-primary" @click="start">ลองใหม่</button>
      <button v-else type="button" class="btn-primary" :disabled="!ready || scanning" @click="scan"><Spinner v-if="scanning" class="h-4 w-4" />สแกน</button>
    </template>
  </AppModal>
</template>
