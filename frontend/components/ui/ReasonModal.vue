<script setup>
// Ask for a reason (reject / cancel). <ReasonModal v-model="open" title="ไม่อนุมัติ" @confirm="(reason) => ..." :loading="busy" />
const open = defineModel({ type: Boolean, default: false })
defineProps({ title: { type: String, default: 'ระบุเหตุผล' }, label: { type: String, default: 'เหตุผล' }, confirmText: { type: String, default: 'ยืนยัน' }, danger: { type: Boolean, default: true }, required: { type: Boolean, default: true }, loading: Boolean })
const emit = defineEmits(['confirm'])
const reason = ref('')
watch(open, (v) => { if (v) reason.value = '' })
</script>

<template>
  <AppModal v-model="open" :title="title" size="sm">
    <label class="label">{{ label }}</label>
    <textarea v-model="reason" rows="3" class="input" placeholder="พิมพ์เหตุผล..." />
    <template #footer>
      <button class="btn-secondary" @click="open = false">ยกเลิก</button>
      <button :class="danger ? 'btn-danger' : 'btn-primary'" :disabled="loading || (required && !reason.trim())" @click="emit('confirm', reason.trim())">
        <Spinner v-if="loading" class="h-4 w-4" />{{ confirmText }}
      </button>
    </template>
  </AppModal>
</template>
