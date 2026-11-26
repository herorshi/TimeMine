<script setup>
const store = useTasksStore()
const title = ref('')
const health = ref(null)

onMounted(async () => {
  try {
    health.value = (await useApi().get('/health')).data
  } catch {
    health.value = { status: 'down' }
  }
  store.fetch()
})

async function submit() {
  if (!title.value.trim()) return
  await store.add(title.value.trim())
  title.value = ''
}
</script>

<template>
  <main class="mx-auto max-w-xl px-4 py-10">
    <header class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">TimeMine</h1>
      <span
        class="rounded-full px-3 py-1 text-xs font-medium"
        :class="health?.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'"
      >
        API: {{ health?.status ?? '...' }}
      </span>
    </header>

    <form class="mb-6 flex gap-2" @submit.prevent="submit">
      <input
        v-model="title"
        class="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        placeholder="New task..."
      />
      <button class="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">Add</button>
    </form>

    <p v-if="store.loading" class="text-slate-500">Loading...</p>
    <p v-else-if="store.error" class="text-rose-600">{{ store.error }}</p>
    <ul v-else class="space-y-2">
      <li
        v-for="t in store.items"
        :key="t.id"
        class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
      >
        <input type="checkbox" :checked="t.done" @change="store.toggle(t)" />
        <span class="flex-1" :class="{ 'text-slate-400 line-through': t.done }">{{ t.title }}</span>
        <button class="text-sm text-rose-600 hover:underline" @click="store.remove(t.id)">Delete</button>
      </li>
      <li v-if="!store.items.length" class="text-slate-500">No tasks yet.</li>
    </ul>
  </main>
</template>
