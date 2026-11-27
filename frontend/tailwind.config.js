/** @type {import('tailwindcss').Config} */
export default {
  content: ['./components/**/*.{vue,js}', './layouts/**/*.vue', './pages/**/*.vue', './plugins/**/*.js', './composables/**/*.js', './utils/**/*.js', './app.vue'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Noto Sans Thai"', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
      },
    },
  },
  plugins: [],
}
