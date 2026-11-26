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
      if (err?.response?.status === 401 && useAuthStore().token) {
        useAuthStore().logout()
        navigateTo('/login')
      }
      return Promise.reject(err)
    },
  )
  return { provide: { api } }
})
