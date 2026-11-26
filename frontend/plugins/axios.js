import axios from 'axios'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
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
      if (err?.response?.status === 401 && useAuthStore().expire()) navigateTo('/login?expired=1')
      return Promise.reject(err)
    },
  )
  // idle tabs: leave as soon as the token expires (public pages stay put, e.g. reset-password)
  const nuxtApp = useNuxtApp()
  setInterval(() => nuxtApp.runWithContext(() => {
    const path = useRouter().currentRoute.value.path
    if (useAuthStore().checkExpiry() && !['/forgot-password', '/reset-password'].includes(path)) return navigateTo('/login?expired=1')
  }), 30000)

  return { provide: { api } }
})
