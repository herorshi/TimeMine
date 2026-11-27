<script setup>
// Inline link to another manual topic: <ManualLink to="admin-faces" /> (uses the topic title) or with slot text.
// Topics the reader cannot open render as plain text, so no link leads to a bounce.
import { findTopic, canRead } from '~/utils/manualToc'
const props = defineProps({ to: { type: String, required: true } })
const auth = useAuthStore()
const topic = computed(() => findTopic(props.to))
</script>

<template>
  <NuxtLink v-if="topic && canRead(auth, to)" :to="`/manual/${to}`" class="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600"><slot>{{ topic.title }}</slot></NuxtLink>
  <span v-else class="font-medium"><slot>{{ topic?.title || to }}</slot></span>
</template>
