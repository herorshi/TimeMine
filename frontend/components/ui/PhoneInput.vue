<script setup>
// <PhoneInput v-model="form.phone" /> — Thai phone number: digits only, must start with 0, at most 10 digits (#127).
// Typing or pasting anything else is dropped; an edit that would make the first digit non-zero is undone.
// No `maxlength` on purpose: it would cut a pasted "081-234-5678" to 10 chars before the dashes are removed.
// No `pattern` attr on purpose: an old stored value like 081-234-5678 must not block saving the rest of the form.
// Same attrs as <input>.
defineOptions({ inheritAttrs: false })
const model = defineModel({ type: [String, null], default: '' })
const MAX = 10

function onInput(e) {
  const el = e.target
  const digits = el.value.replace(/\D/g, '').slice(0, MAX)
  const next = digits && digits[0] !== '0' ? (model.value || '') : digits
  if (el.value !== next) el.value = next
  model.value = next
}
</script>

<template>
  <input
    :value="model"
    v-bind="$attrs"
    type="tel"
    inputmode="numeric"
    autocomplete="tel"
    placeholder="0812345678"
    class="input"
    @input="onInput"
  />
</template>
