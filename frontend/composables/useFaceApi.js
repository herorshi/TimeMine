// const { load, loading, ready, progress, error } = useFaceApi()
// const faceapi = await load()  // lazy import + models (client only, loaded once)
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/'

// ~7 MB of models: slow mobile networks need more than a few seconds
const LOAD_TIMEOUT_MS = 60000

const loading = ref(false)
const ready = ref(false)
const progress = ref(0) // 0-100
const error = ref('')
let faceapi = null
let pending = null
let attempt = 0 // a timed-out attempt keeps running; it must not touch the next one's progress

async function download(mine) {
  const lib = await import('@vladmandic/face-api')
  if (mine === attempt) progress.value = 25
  await lib.tf?.ready?.()
  const nets = [lib.nets.tinyFaceDetector, lib.nets.faceLandmark68Net, lib.nets.faceRecognitionNet]
  let done = 0
  await Promise.all(nets.map(async (net) => {
    if (!net.isLoaded) await net.loadFromUri(MODEL_URL)
    done++
    if (mine === attempt) progress.value = 25 + Math.round((done / nets.length) * 75)
  }))
  return lib
}

async function init() {
  loading.value = true
  error.value = ''
  progress.value = 0
  let timer
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('face-api load timeout')), LOAD_TIMEOUT_MS)
    })
    const lib = await Promise.race([download(++attempt), timeout])
    faceapi = lib
    ready.value = true
    return lib
  } catch (e) {
    pending = null // allow retry
    error.value = 'โหลดระบบสแกนใบหน้าไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
    throw e
  } finally {
    clearTimeout(timer)
    loading.value = false
  }
}

export function useFaceApi() {
  const load = () => {
    if (import.meta.server) return Promise.reject(new Error('face-api ใช้ได้เฉพาะบนเบราว์เซอร์'))
    if (faceapi) return Promise.resolve(faceapi)
    if (!pending) pending = init()
    return pending
  }
  return { load, loading, ready, progress, error }
}
