import { defineStore } from 'pinia'

const KEY = 'timemint.token'
const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }

/** true when the JWT's exp has passed, or the token cannot be decoded */
export function isTokenExpired(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))
    return !exp || exp * 1000 <= Date.now()
  } catch { return true }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({ token: read(), user: null }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    role: (s) => s.user?.role,
    isAdmin: (s) => ['admin', 'executive'].includes(s.user?.role),
    isExecutive: (s) => s.user?.role === 'executive',
    /** auth.can('approve.ot') — executive always true; see backend lib/permissions.js */
    can: (s) => (key) => s.user?.role === 'executive' || !!s.user?.permissions?.includes(key),
  },
  actions: {
    async login(email, password) {
      const { data } = await useApi().post('/auth/login', { email, password })
      this.setSession(data)
    },
    async faceLogin(descriptor, photo) {
      const { data } = await useApi().post('/auth/face-login', { descriptor, photo })
      this.setSession(data)
    },
    setSession(data) {
      this.token = data.token
      this.user = data.user
      try { localStorage.setItem(KEY, data.token) } catch {}
    },
    async fetchMe() {
      const { data } = await useApi().get('/auth/me')
      this.user = data
      return data
    },
    /** end a dead session once (parallel 401s: only the first call toasts). The caller navigates. */
    expire() {
      if (!this.token) return false
      this.logout()
      useToast().error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
      return true
    },
    /** true if the stored token had expired and the session was just ended */
    checkExpiry() {
      return !!this.token && isTokenExpired(this.token) && this.expire()
    },
    logout() {
      this.token = null
      this.user = null
      try { localStorage.removeItem(KEY) } catch {}
    },
  },
})
