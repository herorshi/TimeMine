<script setup>
/**
 * Thai date / month / time picker (Buddhist year), animated — replaces <input type="date|month|time">.
 *
 *   <DateInput v-model="form.start_date" />                    // 'YYYY-MM-DD'
 *   <DateInput v-model="month" type="month" />                  // 'YYYY-MM'
 *   <DateInput v-model="form.start_time" type="time" />         // 'HH:mm'
 *   <DateInput v-model="from" :min="today" :max="to" clearable placeholder="เลือกวันที่" />
 *
 * The model is always the same string format the API uses, so it is a drop-in for v-model on native inputs.
 */
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { th } from 'date-fns/locale'

const props = defineProps({
  type: { type: String, default: 'date' }, // date | month | time
  min: String,
  max: String,
  placeholder: String,
  clearable: { type: Boolean, default: false },
  disabled: Boolean,
  required: Boolean,
})
const model = defineModel({ type: String, default: '' })

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const pad = (n) => String(n).padStart(2, '0')
const toDate = (s) => (s ? new Date(`${s}T00:00:00`) : null)

// string model <-> picker model
const value = computed({
  get() {
    const v = model.value
    if (!v) return null
    if (props.type === 'month') { const [y, m] = v.split('-').map(Number); return { year: y, month: m - 1 } }
    if (props.type === 'time') { const [h, m] = v.split(':').map(Number); return { hours: h, minutes: m || 0, seconds: 0 } }
    return toDate(v)
  },
  set(v) {
    if (!v) return (model.value = '')
    if (props.type === 'month') return (model.value = `${v.year}-${pad(v.month + 1)}`)
    if (props.type === 'time') return (model.value = `${pad(v.hours)}:${pad(v.minutes)}`)
    model.value = `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  },
})

const display = (d) => {
  if (!d) return ''
  if (props.type === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
  if (props.type === 'time') return `${pad(d.getHours())}:${pad(d.getMinutes())} น.`
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`
}
const ph = computed(() => props.placeholder || ({ month: 'เลือกเดือน', time: 'เลือกเวลา' })[props.type] || 'เลือกวันที่')
</script>

<template>
  <VueDatePicker
    v-model="value"
    class="tm-date"
    :locale="th"
    :formats="{ input: display, preview: display }"
    :month-picker="type === 'month'"
    :time-picker="type === 'time'"
    :time-config="{ enableTimePicker: type === 'time', is24: true }"
    :min-date="type === 'date' ? toDate(min) || undefined : undefined"
    :max-date="type === 'date' ? toDate(max) || undefined : undefined"
    :placeholder="ph"
    :clearable="clearable"
    :disabled="disabled"
    :input-attrs="{ required, clearable }"
    :week-start="0"
    :teleport="true"
    :transitions="{ open: 'tm-dp-open', close: 'tm-dp-open', next: 'tm-dp-next', previous: 'tm-dp-prev', menuAppearTop: 'tm-dp-open', menuAppearBottom: 'tm-dp-open', vNext: 'tm-dp-next', vPrevious: 'tm-dp-prev' }"
    auto-apply
    :action-row="{ showNow: true, nowBtnLabel: 'วันนี้', selectBtnLabel: 'เลือก', cancelBtnLabel: 'ยกเลิก' }"
  >
    <template #year="{ year }">{{ year + 543 }}</template>
    <template #year-overlay-value="{ value: y }">{{ y + 543 }}</template>
  </VueDatePicker>
</template>

<style>
/* Brand theme + Buddhist-era friendly sizing. Animations use transform/opacity only. */
.dp__theme_light {
  --dp-primary-color: #059669;
  --dp-primary-text-color: #fff;
  --dp-hover-color: #ecfdf5;
  --dp-border-color: #cbd5e1;
  --dp-border-color-hover: #10b981;
  --dp-menu-border-color: #e2e8f0;
  --dp-border-radius: 0.75rem;
  --dp-cell-border-radius: 0.6rem;
  --dp-font-family: "Noto Sans Thai", ui-sans-serif, system-ui, sans-serif;
  --dp-font-size: 0.875rem;
  --dp-input-padding: 8px 32px 8px 34px;
  --dp-success-color: #10b981;
}
.tm-date .dp__input { font-family: var(--dp-font-family); min-height: 38px; }
.tm-date .dp__input:focus { box-shadow: 0 0 0 3px #d1fae5; }
.dp__menu { box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.28); }
.dp__today { border-color: #10b981; }
.dp__cell_inner { transition: transform 0.15s ease, background-color 0.15s ease; }
.dp__cell_inner:hover { transform: scale(1.08); }
.dp__active_date { box-shadow: 0 4px 12px -4px rgba(5, 150, 105, 0.6); }

.tm-dp-open-enter-active, .tm-dp-open-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.tm-dp-open-enter-from, .tm-dp-open-leave-to { opacity: 0; transform: translateY(-6px) scale(0.98); }
.tm-dp-next-enter-active, .tm-dp-prev-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.tm-dp-next-leave-active, .tm-dp-prev-leave-active { display: none; }
.tm-dp-next-enter-from { opacity: 0; transform: translateX(18px); }
.tm-dp-prev-enter-from { opacity: 0; transform: translateX(-18px); }
@media (prefers-reduced-motion: reduce) {
  .tm-dp-open-enter-active, .tm-dp-open-leave-active, .tm-dp-next-enter-active, .tm-dp-prev-enter-active, .dp__cell_inner { transition: none; }
}
</style>
