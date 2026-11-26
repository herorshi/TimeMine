<script setup>
// <FaceScanner v-model="open" title="..." @captured="({ descriptor, descriptors, photo }) => ..." />
// descriptor = number[128] (average of descriptors), photo = JPEG data URL (<= 640px)
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
let motion = null // liveness tracking: { origin, eyeOpen, eyeClosed, misses }
const alive = ref(false) // liveness passed: head moved or eyes blinked
let autoAfter = 0

const detectorOptions = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })

const status = computed(() => {
  if (cameraState.value === 'permission') return 'กรุณากดอนุญาตการใช้กล้อง'
  if (cameraState.value === 'starting') return 'กำลังเปิดกล้อง...'
  if (modelState.value === 'loading') return 'กำลังโหลดระบบสแกนใบหน้า...'
  if (modelState.value === 'error') return ''
  if (scanning.value) return 'กำลังสแกน กรุณาอยู่นิ่งๆ...'
  if (!hasFace.value) return 'จัดใบหน้าให้อยู่ตรงกลางกล้อง'
  return alive.value ? 'ยืนยันแล้ว อยู่นิ่งๆ ระบบจะสแกนอัตโนมัติ หรือกดปุ่ม "สแกน"' : 'พบใบหน้าแล้ว กรุณาขยับศีรษะเล็กน้อย หรือ กระพริบตา'
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
  resetLiveness()
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

function resetLiveness() {
  motion = null
  alive.value = false
}

// eye aspect ratio: drops sharply while the eye is closed
function eyeRatio(p) {
  const d = (a, b) => Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y)
  return (d(1, 5) + d(2, 4)) / (2 * d(0, 3))
}

// basic liveness (docs/face.md): face centre moves >= 4% of the frame width, or a blink (close, then reopen)
function checkLiveness(found) {
  if (!found) {
    if (motion && ++motion.misses >= 3) resetLiveness() // face gone: start over
    return
  }
  const { x, y, width, height } = found.detection.box
  const centre = { x: x + width / 2, y: y + height / 2 }
  const ear = (eyeRatio(found.landmarks.getLeftEye()) + eyeRatio(found.landmarks.getRightEye())) / 2
  if (!motion) motion = { origin: centre, eyeOpen: ear, eyeClosed: false, misses: 0 }
  motion.misses = 0
  if (Math.hypot(centre.x - motion.origin.x, centre.y - motion.origin.y) >= video.value.videoWidth * 0.04) alive.value = true
  if (ear < motion.eyeOpen * 0.75) motion.eyeClosed = true
  else if (motion.eyeClosed && ear > motion.eyeOpen * 0.9) alive.value = true
  motion.eyeOpen = Math.max(motion.eyeOpen, ear)
}

// evidence photo (not mirrored), longest side <= 640px
function snapshot() {
  const v = video.value
  const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(v.videoWidth * scale)
  c.height = Math.round(v.videoHeight * scale)
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

// live face-box overlay + liveness + auto-capture
async function track(mine) {
  if (mine !== session) return
  if (ready.value && !scanning.value && video.value?.videoWidth) {
    try {
      const found = await faceapi.detectSingleFace(video.value, detectorOptions()).withFaceLandmarks()
      if (mine !== session) return
      const box = found?.detection.box
      hasFace.value = !!found
      drawBox(found?.detection)
      checkLiveness(found)
      const still = isSteady(box)
      if (!scanning.value && alive.value && still && Date.now() >= autoAfter) scan()
    } catch { /* skip this frame */ }
  }
  timer = setTimeout(() => track(mine), 200)
}

async function scan() {
  if (scanning.value || !ready.value || !alive.value) return
  const mine = session
  scanning.value = true
  scanError.value = ''
  steady = null
  try {
    const found = []
    let photo = ''
    for (let i = 0; i < props.samples * 3 && found.length < props.samples && mine === session; i++) {
      const result = await faceapi.detectSingleFace(video.value, detectorOptions()).withFaceLandmarks().withFaceDescriptor()
      if (mine !== session) return
      if (result) {
        photo ||= snapshot()
        found.push(result.descriptor)
      }
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
    emit('captured', { descriptor, descriptors: found.map((d) => Array.from(d)), photo })
  } catch {
    if (mine === session) scanError.value = 'สแกนใบหน้าไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    if (mine === session) {
      scanning.value = false
      autoAfter = Date.now() + RETRY_DELAY_MS
      if (scanError.value) resetLiveness()
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
      <button v-else type="button" class="btn-primary" :disabled="!ready || scanning || !alive || !hasFace" @click="scan"><Spinner v-if="scanning" class="h-4 w-4" />สแกน</button>
    </template>
  </AppModal>
</template>
