export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false, // SPA: camera, localStorage token, no SSR needed for an internal tool
  devtools: { enabled: false },
  // components/ui/AppModal.vue is <AppModal>, not <UiAppModal>
  components: [{ path: '~/components', pathPrefix: false }],
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: { apiBase: 'http://localhost:4000/api' }, // NUXT_PUBLIC_API_BASE
  },
  app: {
    head: {
      title: 'TimeMint',
      htmlAttrs: { lang: 'th' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap' },
      ],
    },
  },
})
