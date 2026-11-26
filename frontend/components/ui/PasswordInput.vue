<script setup>
// <PasswordInput v-model="form.password" required autocomplete="current-password" />
// Same attrs as <input>; adds an eye button to show / hide the value.
defineOptions({ inheritAttrs: false })
const model = defineModel({ type: String, default: '' })
const show = ref(false)
</script>

<template>
  <div class="relative">
    <input v-model="model" v-bind="$attrs" :type="show ? 'text' : 'password'" class="input pr-10" />
    <button
      type="button"
      class="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-slate-600 focus:text-brand-600 focus:outline-none"
      :aria-label="show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'"
      :aria-pressed="show"
      tabindex="0"
      @click="show = !show"
    >
      <svg v-if="!show" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5c4.64 0 8.57 3 9.96 7.18.07.2.07.43 0 .64C20.58 16.49 16.64 19.5 12 19.5c-4.64 0-8.57-3-9.96-7.18Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.22A10.48 10.48 0 0 0 1.93 12c1.3 4.34 5.31 7.5 10.07 7.5.99 0 1.95-.14 2.86-.4M6.23 6.23A10.45 10.45 0 0 1 12 4.5c4.76 0 8.77 3.16 10.07 7.5a10.52 10.52 0 0 1-4.29 5.77M6.23 6.23 3 3m3.23 3.23 3.65 3.65m7.89 7.89L21 21m-3.23-3.23-3.65-3.65m0 0a3 3 0 1 0-4.24-4.24m4.24 4.24L9.88 9.88" /></svg>
    </button>
  </div>
</template>
