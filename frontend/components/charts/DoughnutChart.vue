<script setup>
// <DoughnutChart :labels="[]" :values="[]" :colors="[]" />
import { Doughnut } from 'vue-chartjs'
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js'

Chart.register(ArcElement, Tooltip, Legend)

const props = defineProps({ labels: { type: Array, default: () => [] }, values: { type: Array, default: () => [] }, colors: { type: Array, default: () => [] } })
const data = computed(() => ({ labels: props.labels, datasets: [{ data: props.values, backgroundColor: props.colors, borderColor: '#fff', borderWidth: 2 }] }))
const options = { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' } } }
</script>

<template>
  <div class="relative h-72 w-full">
    <Doughnut :data="data" :options="options" />
  </div>
</template>
