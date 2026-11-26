<script setup>
import { ROLE_LABELS } from '~/utils/constants'
import { apiError } from '~/utils/format'
definePageMeta({ roles: ['executive'] })

const api = useApi()
const toast = useToast()

const TABS = [{ key: 'roles', label: 'ตามบทบาท' }, { key: 'users', label: 'รายบุคคล' }]
const GROUPS = [
  { key: 'employee', label: 'สิทธิ์พนักงาน', roles: ['employee', 'admin'] },
  { key: 'admin', label: 'สิทธิ์ Admin', roles: ['admin'] },
]
const CHOICES = [
  { value: null, label: 'ตามบทบาท', on: 'bg-brand-600 text-white' },
  { value: true, label: 'อนุญาต', on: 'bg-emerald-600 text-white' },
  { value: false, label: 'ไม่อนุญาต', on: 'bg-rose-600 text-white' },
]

const tab = ref('roles')
const loading = ref(true)
const loadError = ref('')
const catalog = ref([])
const users = ref([])
const search = ref('')

const keysOf = (group) => catalog.value.filter((p) => p.group === group)

// --- tab: by role ---
const saved = ref({ admin: {}, employee: {} })
const draft = reactive({ admin: {}, employee: {} })
const saving = ref(false)

function setMatrix(m) {
  saved.value = m
  draft.admin = { ...m.admin }
  draft.employee = { ...m.employee }
}
// employee-group keys are one shared value for every role, stored on the employee row
const rowOf = (group) => (group === 'employee' ? 'employee' : 'admin')
const changedKeys = (group) => keysOf(group).map((p) => p.key).filter((k) => draft[rowOf(group)][k] !== saved.value[rowOf(group)][k])
const dirtyCount = computed(() => changedKeys('employee').length + changedKeys('admin').length)

function toggle(group, key) {
  draft[rowOf(group)][key] = !draft[rowOf(group)][key]
}

async function saveRoles() {
  saving.value = true
  // keep edits of a role that has not been saved yet if a later request fails
  const pending = GROUPS.map((g) => ({
    role: rowOf(g.key),
    perms: Object.fromEntries(changedKeys(g.key).map((k) => [k, draft[rowOf(g.key)][k]])),
  })).filter((p) => Object.keys(p.perms).length)
  try {
    let matrix
    for (const body of pending) {
      matrix = (await api.put('/permissions/roles', body)).data
      saved.value = matrix
    }
    if (matrix) setMatrix(matrix)
    toast.success('บันทึกสิทธิ์ตามบทบาทแล้ว')
  } catch (e) { toast.error(apiError(e)) } finally { saving.value = false }
}

// --- tab: per person ---
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = users.value.filter((u) => u.role !== 'executive')
  if (!q) return list
  return list.filter((u) => [u.emp_code, u.name, u.email, u.department, u.position].some((v) => String(v || '').toLowerCase().includes(q)))
})

const modalOpen = ref(false)
const selected = ref(null)
const detail = ref(null)
const userSaving = ref(false)
const choices = ref({})
let requestNo = 0

const userGroups = computed(() => GROUPS
  .map((g) => ({ ...g, items: keysOf(g.key).filter((p) => detail.value && p.key in detail.value.role_defaults) }))
  .filter((g) => g.items.length))
const effective = (key) => choices.value[key] ?? detail.value.role_defaults[key]
const userDirty = computed(() => !!detail.value && Object.keys(choices.value).some((k) => choices.value[k] !== (detail.value.overrides[k] ?? null)))

function setDetail(d) {
  detail.value = d
  choices.value = Object.fromEntries(Object.keys(d.role_defaults).map((k) => [k, d.overrides[k] ?? null]))
}

async function openUser(u) {
  const no = ++requestNo
  selected.value = u
  detail.value = null
  choices.value = {}
  modalOpen.value = true
  try {
    const { data } = await api.get(`/permissions/users/${u.id}`)
    if (no === requestNo) setDetail(data)
  } catch (e) {
    if (no === requestNo) { toast.error(apiError(e)); modalOpen.value = false }
  }
}

async function saveUser() {
  userSaving.value = true
  const { id, name } = selected.value
  try {
    await api.put(`/permissions/users/${id}`, { overrides: choices.value })
    toast.success(`บันทึกสิทธิ์ของ ${name} แล้ว`)
    if (selected.value.id === id) modalOpen.value = false
  } catch (e) { toast.error(apiError(e)) } finally { userSaving.value = false }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [c, r, u] = await Promise.all([api.get('/permissions/catalog'), api.get('/permissions/roles'), api.get('/users')])
    catalog.value = c.data
    setMatrix(r.data)
    users.value = u.data
  } catch (e) {
    loadError.value = apiError(e)
    toast.error(loadError.value)
  } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="สิทธิ์การใช้งาน" subtitle="กำหนดสิทธิ์ของพนักงานและ Admin ตามบทบาท หรือรายบุคคล" />

    <p class="mb-4 max-w-3xl rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700">ผู้บริหารมีสิทธิ์ทุกอย่างเสมอ</p>

    <div class="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
      <button
        v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key"
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
        :class="tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <LoadingBlock v-if="loading" />
    <div v-else-if="loadError" class="card text-center">
      <EmptyState icon="⚠️" :text="loadError" />
      <button class="btn-secondary" @click="load">ลองใหม่</button>
    </div>

    <div v-else-if="tab === 'roles'" class="max-w-3xl space-y-5">
      <section v-for="g in GROUPS" :key="g.key">
        <h2 class="mb-1 text-base font-semibold text-slate-800">{{ g.label }}</h2>
        <p v-if="g.key === 'employee'" class="mb-2 text-xs text-slate-500">สิทธิ์กลุ่มนี้ใช้ค่าเดียวกันทุกบทบาท เปลี่ยนช่องใดช่องหนึ่ง อีกช่องจะเปลี่ยนตาม</p>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>สิทธิ์</th>
                <th v-for="role in g.roles" :key="role" class="w-20 !text-center sm:w-28">{{ ROLE_LABELS[role] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in keysOf(g.key)" :key="p.key" :class="{ 'bg-amber-50': changedKeys(g.key).includes(p.key) }">
                <td>{{ p.label }}</td>
                <td v-for="role in g.roles" :key="role" class="text-center">
                  <button
                    type="button" role="switch" :aria-checked="!!draft[rowOf(g.key)][p.key]" :aria-label="`${p.label} (${ROLE_LABELS[role]})`"
                    class="relative inline-flex h-6 w-11 items-center rounded-full align-middle transition disabled:opacity-50"
                    :class="draft[rowOf(g.key)][p.key] ? 'bg-brand-600' : 'bg-slate-300'"
                    :disabled="saving" @click="toggle(g.key, p.key)"
                  >
                    <span class="inline-block h-5 w-5 rounded-full bg-white shadow transition" :class="draft[rowOf(g.key)][p.key] ? 'translate-x-[22px]' : 'translate-x-0.5'" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="flex flex-wrap items-center justify-end gap-3">
        <p v-if="dirtyCount" class="mr-auto text-sm font-medium text-amber-600">มีการเปลี่ยนแปลง {{ dirtyCount }} รายการที่ยังไม่ได้บันทึก</p>
        <button v-if="dirtyCount" class="btn-secondary" :disabled="saving" @click="setMatrix(saved)">ยกเลิกการแก้ไข</button>
        <button class="btn-primary" :disabled="!dirtyCount || saving" @click="saveRoles"><Spinner v-if="saving" class="h-4 w-4" />บันทึก</button>
      </div>
    </div>

    <div v-else class="max-w-3xl">
      <input v-model="search" type="search" class="input mb-4 sm:max-w-sm" placeholder="ค้นหา รหัส ชื่อ อีเมล แผนก ตำแหน่ง" />
      <div v-if="!filtered.length" class="card"><EmptyState text="ไม่พบผู้ใช้" /></div>
      <ul v-else class="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <li v-for="u in filtered" :key="u.id">
          <button type="button" class="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50" :class="{ 'opacity-60': !u.active }" @click="openUser(u)">
            <span class="min-w-0 flex-1">
              <span class="block break-words text-sm font-medium text-slate-800">{{ u.name }}</span>
              <span class="block break-words text-xs text-slate-500">{{ [u.emp_code, u.department, u.position].filter(Boolean).join(' · ') }}</span>
            </span>
            <StatusBadge v-if="!u.active" label="ปิดการใช้งาน" color="slate" />
            <StatusBadge :label="ROLE_LABELS[u.role]" :color="u.role === 'admin' ? 'violet' : 'sky'" />
            <span class="text-slate-400">›</span>
          </button>
        </li>
      </ul>
    </div>

    <AppModal v-model="modalOpen" :title="selected ? `สิทธิ์ของ ${selected.name}` : ''" size="lg">
      <LoadingBlock v-if="!detail" />
      <div v-else class="space-y-4">
        <p class="text-xs text-slate-500">{{ detail.user.emp_code }} · {{ ROLE_LABELS[detail.user.role] }}<template v-if="detail.user.department"> · {{ detail.user.department }}</template></p>
        <section v-for="g in userGroups" :key="g.key">
          <h4 class="text-sm font-semibold text-slate-800">{{ g.label }}</h4>
          <div class="divide-y divide-slate-100">
            <div v-for="p in g.items" :key="p.key" class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0">
                <p class="text-sm text-slate-700">{{ p.label }}</p>
                <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span>ค่าตามบทบาท: {{ detail.role_defaults[p.key] ? 'อนุญาต' : 'ไม่อนุญาต' }}</span>
                  <StatusBadge :label="effective(p.key) ? 'ผล: ใช้งานได้' : 'ผล: ใช้งานไม่ได้'" :color="effective(p.key) ? 'emerald' : 'rose'" />
                </p>
              </div>
              <div class="grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" :aria-label="p.label">
                <button
                  v-for="c in CHOICES" :key="c.label" type="button" role="radio" :aria-checked="choices[p.key] === c.value"
                  class="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                  :class="choices[p.key] === c.value ? c.on : 'text-slate-600 hover:bg-white'"
                  :disabled="userSaving" @click="choices[p.key] = c.value"
                >{{ c.label }}</button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <template #footer>
        <p v-if="userDirty" class="mr-auto self-center text-xs font-medium text-amber-600">ยังไม่ได้บันทึก</p>
        <button class="btn-secondary" @click="modalOpen = false">ปิด</button>
        <button class="btn-primary" :disabled="!userDirty || userSaving" @click="saveUser"><Spinner v-if="userSaving" class="h-4 w-4" />บันทึก</button>
      </template>
    </AppModal>
  </div>
</template>
