import axios from 'axios'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const api = axios.create({
    baseURL: config.public.apiBase,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  })

  api.interceptors.response.use(
    (res) => res,
    (err) => {
      console.error('[api]', err?.response?.status, err?.message)
      return Promise.reject(err)
    },
  )

  return { provide: { api } }
})
