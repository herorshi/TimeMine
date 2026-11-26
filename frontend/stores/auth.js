import { defineStore } from 'pinia'

const KEY = 'timemint.token'
const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }

export const useAuthStore = defineStore('auth', {
  state: () => ({ token: read(), user: null }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    role: (s) => s.user?.role,
    isAdmin: (s) => ['admin', 'executive'].includes(s.user?.role),
    isExecutive: (s) => s.user?.role === 'executive',
  },
  actions: {
    async login(email, password) {
      const { data } = await useApi().post('/auth/login', { email, password })
      this.token = data.token
      this.user = data.user
      try { localStorage.setItem(KEY, data.token) } catch {}
    },
    async fetchMe() {
      const { data } = await useApi().get('/auth/me')
      this.user = data
      return data
    },
    logout() {
      this.token = null
      this.user = null
      try { localStorage.removeItem(KEY) } catch {}
    },
  },
})
