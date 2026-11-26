// Pages declare access with definePageMeta({ roles: ['admin'] }). executive passes every admin check.
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (to.path === '/login') return auth.isLoggedIn ? navigateTo('/') : undefined
  if (!auth.isLoggedIn) return navigateTo('/login')
  if (!auth.user) {
    try { await auth.fetchMe() } catch { auth.logout(); return navigateTo('/login') }
  }
  const roles = to.meta.roles
  if (roles && !roles.includes(auth.user.role) && auth.user.role !== 'executive') return navigateTo('/')
})
