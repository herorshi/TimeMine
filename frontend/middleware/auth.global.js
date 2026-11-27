// Pages declare access with definePageMeta({ roles: ['admin'] }). executive passes every admin check.
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  const PUBLIC = ['/login', '/forgot-password', '/reset-password']
  // app start and every route change
  if (auth.checkExpiry() && !PUBLIC.includes(to.path)) return navigateTo('/login?expired=1')
  if (PUBLIC.includes(to.path)) return to.path === '/login' && auth.isLoggedIn ? navigateTo('/') : undefined
  if (!auth.isLoggedIn) return navigateTo('/login')
  if (!auth.user) {
    try { await auth.fetchMe() } catch (e) {
      auth.logout() // on 401 the axios interceptor has already toasted and cleared the session
      return navigateTo(e?.response?.status === 401 ? '/login?expired=1' : '/login')
    }
  }
  const roles = to.meta.roles
  if (roles && !roles.includes(auth.user.role) && auth.user.role !== 'executive') return navigateTo('/')
  if (to.meta.perm && !auth.can(to.meta.perm)) return navigateTo('/')
})
