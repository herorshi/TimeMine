<script setup>
const open = defineModel({ type: Boolean, default: false })
defineProps({ title: { type: String, default: 'ยืนยัน' }, message: String, confirmText: { type: String, default: 'ยืนยัน' }, danger: Boolean, loading: Boolean })
const emit = defineEmits(['confirm'])
</script>

<template>
  <AppModal v-model="open" :title="title" size="sm">
    <p class="text-sm text-slate-600">{{ message }}</p>
    <template #footer>
      <button class="btn-secondary" @click="open = false">ยกเลิก</button>
      <button :class="danger ? 'btn-danger' : 'btn-primary'" :disabled="loading" @click="emit('confirm')"><Spinner v-if="loading" class="h-4 w-4" />{{ confirmText }}</button>
    </template>
  </AppModal>
</template>
