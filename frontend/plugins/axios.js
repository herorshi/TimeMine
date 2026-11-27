import axios from 'axios'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const PUBLIC = ['/login', '/forgot-password', '/reset-password']
  // Leave for /login from anywhere (interceptors and timers run outside the Nuxt context, so navigateTo alone is not enough).
  const kickOut = () => {
    const path = window.location.pathname
    if (PUBLIC.includes(path)) return
    try { Promise.resolve(nuxtApp.runWithContext(() => navigateTo('/login?expired=1', { replace: true }))).catch(() => {}) } catch {}
    setTimeout(() => { if (window.location.pathname === path) window.location.replace('/login?expired=1') }, 400)
  }
  const inflight = useState('api-inflight', () => 0) // drives <TopProgress/>
  const api = axios.create({ baseURL: config.public.apiBase, timeout: 20000 })

  api.interceptors.request.use((req) => {
    inflight.value++
    const token = useAuthStore().token
    if (token) req.headers.Authorization = `Bearer ${token}`
    return req
  })
  api.interceptors.response.use(
    (res) => { inflight.value--; return res },
    (err) => {
      inflight.value--
      if (err?.response?.status === 401 && !String(err.config?.url || '').includes('/auth/login') && useAuthStore().expire()) kickOut()
      return Promise.reject(err)
    },
  )
  // idle tabs: leave as soon as the token expires (public pages stay put, e.g. reset-password)
  setInterval(() => { if (useAuthStore().checkExpiry()) kickOut() }, 30000)
  // back to the tab: expired locally → out; revoked on the server (password changed, account disabled) → /auth/me 401 → out
  const recheck = () => {
    if (document.visibilityState !== 'visible') return
    const auth = useAuthStore()
    if (auth.checkExpiry()) return kickOut()
    if (auth.token && !PUBLIC.includes(window.location.pathname)) api.get('/auth/me').catch(() => {})
  }
  document.addEventListener('visibilitychange', recheck)
  window.addEventListener('focus', recheck)

  return { provide: { api } }
})
