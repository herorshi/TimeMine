<script setup>
/**
 * Shared table: per-column filters, click-to-sort, client-side pagination.
 *
 * <DataTable :columns="cols" :rows="items" row-key="id" :loading="loading" empty-text="ยังไม่มีข้อมูล">
 *   <template #cell-status="{ row, value }"><StatusBadge :status="value" /></template>
 *   <template #actions="{ row }"><button class="btn-secondary btn-sm">...</button></template>
 * </DataTable>
 *
 * column: {
 *   key: 'status', label: 'สถานะ',
 *   filter: 'text' (default) | 'select' | 'date' | 'none',
 *   options: [{ value, label }]        // for 'select'; default = distinct values of the column
 *   value: (row) => any                 // raw value for filter/sort (default row[key])
 *   text:  (row) => string              // text shown + used by the text filter (default String(value))
 *   sortable: true (default) | false,  align: 'left' | 'right' | 'center',  class: 'whitespace-nowrap'
 * }
 */
const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  rowKey: { type: [String, Function], default: 'id' },
  loading: Boolean,
  emptyText: { type: String, default: 'ยังไม่มีข้อมูล' },
  pageSize: { type: Number, default: 10 },
  pageSizes: { type: Array, default: () => [10, 20, 50, 100] },
  rowClass: { type: Function, default: null },
})
const slots = useSlots()
const hasActions = computed(() => !!slots.actions)

const filters = reactive({})
const sortKey = ref(null)
const sortDir = ref(1)
const page = ref(1)
const size = ref(props.pageSize)

const colValue = (c, r) => (c.value ? c.value(r) : r?.[c.key])
const colText = (c, r) => {
  if (c.text) return String(c.text(r) ?? '')
  const v = colValue(c, r)
  return v === null || v === undefined ? '' : String(v)
}
const filterType = (c) => c.filter || 'text'
const selectOptions = (c) => {
  if (c.options) return c.options
  const seen = new Map()
  for (const r of props.rows) {
    const v = colValue(c, r)
    if (v !== null && v !== undefined && v !== '' && !seen.has(String(v))) seen.set(String(v), colText(c, r))
  }
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'th'))
}

const filtered = computed(() => {
  const active = props.columns.filter((c) => filterType(c) !== 'none' && filters[c.key] !== undefined && filters[c.key] !== '')
  if (!active.length) return props.rows
  return props.rows.filter((r) =>
    active.every((c) => {
      const f = String(filters[c.key]).toLowerCase().trim()
      const t = filterType(c)
      if (t === 'select') return String(colValue(c, r)) === String(filters[c.key])
      if (t === 'date') return String(colValue(c, r) ?? '').startsWith(filters[c.key])
      return colText(c, r).toLowerCase().includes(f) || String(colValue(c, r) ?? '').toLowerCase().includes(f)
    }),
  )
})
const sorted = computed(() => {
  if (!sortKey.value) return filtered.value
  const c = props.columns.find((x) => x.key === sortKey.value)
  return [...filtered.value].sort((a, b) => {
    const va = colValue(c, a), vb = colValue(c, b)
    if (va === vb) return 0
    if (va === null || va === undefined) return 1
    if (vb === null || vb === undefined) return -1
    const n = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'th', { numeric: true })
    return n * sortDir.value
  })
})
const pages = computed(() => Math.max(1, Math.ceil(sorted.value.length / size.value)))
const visible = computed(() => sorted.value.slice((page.value - 1) * size.value, page.value * size.value))
const from = computed(() => (sorted.value.length ? (page.value - 1) * size.value + 1 : 0))
const to = computed(() => Math.min(page.value * size.value, sorted.value.length))
const anyFilter = computed(() => Object.values(filters).some((v) => v !== undefined && v !== ''))

watch([filters, size, () => props.rows], () => { page.value = 1 }, { deep: true })
watch(pages, (n) => { if (page.value > n) page.value = n })

function toggleSort(c) {
  if (c.sortable === false) return
  if (sortKey.value !== c.key) { sortKey.value = c.key; sortDir.value = 1 }
  else if (sortDir.value === 1) sortDir.value = -1
  else { sortKey.value = null; sortDir.value = 1 }
}
function clearFilters() { for (const k of Object.keys(filters)) filters[k] = '' }
const keyOf = (r, i) => (typeof props.rowKey === 'function' ? props.rowKey(r) : r?.[props.rowKey] ?? i)
const align = (c) => ({ right: 'text-right', center: 'text-center' })[c.align] || ''

// compact page list: 1 … 4 5 [6] 7 8 … 20
const pageList = computed(() => {
  const n = pages.value, p = page.value
  const set = new Set([1, n, p - 1, p, p + 1].filter((x) => x >= 1 && x <= n))
  const out = []
  let prev = 0
  for (const x of [...set].sort((a, b) => a - b)) { if (x - prev > 1) out.push('…'); out.push(x); prev = x }
  return out
})
</script>

<template>
  <div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" :class="[align(c), c.sortable === false ? '' : 'cursor-pointer select-none hover:text-slate-800']" @click="toggleSort(c)">
              <span class="inline-flex items-center gap-1">
                {{ c.label }}
                <span v-if="sortKey === c.key" class="text-brand-600">{{ sortDir === 1 ? '▲' : '▼' }}</span>
              </span>
            </th>
            <th v-if="hasActions" class="text-right">จัดการ</th>
          </tr>
          <tr class="bg-white">
            <th v-for="c in columns" :key="c.key + '-f'" class="!bg-white !py-1.5 font-normal">
              <select v-if="filterType(c) === 'select'" v-model="filters[c.key]" class="input !py-1 !text-xs" :aria-label="`กรอง ${c.label}`">
                <option value="">ทั้งหมด</option>
                <option v-for="o in selectOptions(c)" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <input v-else-if="filterType(c) === 'date'" v-model="filters[c.key]" type="date" class="input !py-1 !text-xs" :aria-label="`กรอง ${c.label}`" />
              <input v-else-if="filterType(c) === 'text'" v-model="filters[c.key]" type="search" class="input !py-1 !text-xs" placeholder="ค้นหา…" :aria-label="`กรอง ${c.label}`" />
            </th>
            <th v-if="hasActions" class="!bg-white !py-1.5 text-right">
              <button v-if="anyFilter" class="text-xs font-medium text-brand-700 hover:underline" @click="clearFilters">ล้างตัวกรอง</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td :colspan="columns.length + (hasActions ? 1 : 0)"><LoadingBlock /></td></tr>
          <tr v-else-if="!visible.length"><td :colspan="columns.length + (hasActions ? 1 : 0)"><EmptyState :text="anyFilter ? 'ไม่พบข้อมูลตามตัวกรอง' : emptyText" /></td></tr>
          <template v-else>
            <tr v-for="(r, i) in visible" :key="keyOf(r, i)" class="transition-colors hover:bg-slate-50" :class="rowClass ? rowClass(r) : ''">
              <td v-for="c in columns" :key="c.key" :class="[align(c), c.class]">
                <slot :name="`cell-${c.key}`" :row="r" :value="colValue(c, r)">{{ colText(c, r) || '-' }}</slot>
              </td>
              <td v-if="hasActions" class="whitespace-nowrap text-right"><slot name="actions" :row="r" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
      <div class="flex items-center gap-2">
        <span>แสดง {{ from }}–{{ to }} จาก {{ sorted.length }}<template v-if="sorted.length !== rows.length"> (ทั้งหมด {{ rows.length }})</template></span>
        <select v-model.number="size" class="input !w-auto !py-1 !text-xs" aria-label="จำนวนต่อหน้า">
          <option v-for="s in pageSizes" :key="s" :value="s">{{ s }} / หน้า</option>
        </select>
      </div>
      <div v-if="pages > 1" class="flex items-center gap-1">
        <button class="btn-ghost btn-sm" :disabled="page === 1" aria-label="หน้าก่อน" @click="page--">‹</button>
        <template v-for="(p, i) in pageList" :key="i">
          <span v-if="p === '…'" class="px-1">…</span>
          <button v-else class="btn-sm min-w-[2rem] rounded-lg" :class="p === page ? 'bg-brand-600 font-semibold text-white' : 'btn-ghost'" @click="page = p">{{ p }}</button>
        </template>
        <button class="btn-ghost btn-sm" :disabled="page === pages" aria-label="หน้าถัดไป" @click="page++">›</button>
      </div>
    </div>
  </div>
</template>
