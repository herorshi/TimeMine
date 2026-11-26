import { defineStore } from 'pinia'

export const useTasksStore = defineStore('tasks', {
  state: () => ({ items: [], loading: false, error: null }),
  actions: {
    async fetch() {
      this.loading = true
      this.error = null
      try {
        const { data } = await useApi().get('/tasks')
        this.items = data
      } catch (e) {
        this.error = e?.message || 'Failed to load'
      } finally {
        this.loading = false
      }
    },
    async add(title) {
      const { data } = await useApi().post('/tasks', { title })
      this.items.unshift(data)
    },
    async toggle(task) {
      const { data } = await useApi().patch(`/tasks/${task.id}`, { done: !task.done })
      Object.assign(task, data)
    },
    async remove(id) {
      await useApi().delete(`/tasks/${id}`)
      this.items = this.items.filter((t) => t.id !== id)
    },
  },
})
