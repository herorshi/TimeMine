<script setup>
// <LineChart :labels="[]" :datasets="[{ label, data, ... }]" />
import { Line } from 'vue-chartjs'
import { Chart, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend } from 'chart.js'

Chart.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend)

const props = defineProps({ labels: { type: Array, default: () => [] }, datasets: { type: Array, default: () => [] } })
const data = computed(() => ({ labels: props.labels, datasets: props.datasets }))
const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: props.datasets.length > 1, position: 'bottom' } },
  scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
}
</script>

<template>
  <div class="relative h-72 w-full">
    <Line :data="data" :options="options" />
  </div>
</template>
