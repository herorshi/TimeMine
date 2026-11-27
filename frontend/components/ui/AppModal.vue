<script setup>
// <AppModal v-model="open" title="..." size="md"> body <template #footer>buttons</template></AppModal>
const open = defineModel({ type: Boolean, default: false })
const props = defineProps({ title: String, size: { type: String, default: 'md' }, persistent: Boolean })
const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
const close = () => { if (!props.persistent) open.value = false }
onKeyStroke('Escape', close)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" @click.self="close">
        <div class="modal-panel flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" :class="widths[size]">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 class="text-base font-semibold text-slate-800">{{ title }}</h3>
            <button class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="ปิด" @click="open = false">✕</button>
          </div>
          <div class="overflow-y-auto px-5 py-4"><slot /></div>
          <div v-if="$slots.footer" class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3"><slot name="footer" /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
