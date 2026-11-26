<script setup>
import { STATUS } from '~/utils/constants'
import { apiError, fmtDate } from '~/utils/format'

definePageMeta({ roles: ['admin'] })

const api = useApi()
const toast = useToast()

const filters = [{ key: '', label: 'ทั้งหมด' }, ...['pending', 'approved', 'rejected', 'cancelled'].map((key) => ({ key, label: STATUS[key].label }))]
const status = ref('')
const rows = ref([])
const loading = ref(true)
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const { data } = await api.get('/leaves', { params: status.value ? { status: status.value } : {} })
    if (mine === seq) rows.value = data // server returns pending first
  } catch (e) {
    if (mine === seq) { rows.value = []; toast.error(apiError(e)) }
  } finally {
    if (mine === seq) loading.value = false
  }
}
onMounted(load)
watch(status, load)

const busyId = ref(null)
const showReject = ref(false)
const rejectTarget = ref(null)

async function review(row, action, body, message) {
  busyId.value = row.id
  try {
    await api.post(`/leaves/${row.id}/${action}`, body)
    toast.success(message)
    showReject.value = false
    await load()
  } catch (e) {
    toast.error(apiError(e))
    await load()
  } finally {
    busyId.value = null
  }
}
const approve = (row) => review(row, 'approve', {}, 'อนุมัติการลาแล้ว')
const reject = (reason) => review(rejectTarget.value, 'reject', { reason }, 'ไม่อนุมัติคำขอแล้ว')
function askReject(row) {
  rejectTarget.value = row
  showReject.value = true
}
const range = (r) => (r.start_date === r.end_date ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} - ${fmtDate(r.end_date)}`)
</script>

<template>
  <div>
    <PageHeader title="อนุมัติการลา" subtitle="คำขอที่รออนุมัติแสดงก่อน" />

    <div class="mb-4 flex flex-wrap gap-2">
      <button v-for="f in filters" :key="f.key" class="btn-sm" :class="status === f.key ? 'btn-primary' : 'btn-secondary'" @click="status = f.key">{{ f.label }}</button>
    </div>

    <LoadingBlock v-if="loading" />
    <div v-else-if="!rows.length" class="card"><EmptyState text="ไม่มีคำขอลา" /></div>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>พนักงาน</th><th>แผนก</th><th>ประเภท</th><th>วันที่ลา</th><th>จำนวน</th><th>เหตุผล</th><th>สถานะ</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="whitespace-nowrap">
              <p class="font-medium text-slate-800">{{ r.user_name }}</p>
              <p class="text-xs text-slate-400">{{ r.emp_code }}</p>
            </td>
            <td class="whitespace-nowrap">{{ r.department || '-' }}</td>
            <td class="whitespace-nowrap">{{ r.type_label }}</td>
            <td class="whitespace-nowrap">{{ range(r) }}</td>
            <td class="whitespace-nowrap">{{ r.days }} วัน</td>
            <td class="min-w-[12rem] break-words">{{ r.reason || '-' }}</td>
            <td class="min-w-[10rem]">
              <StatusBadge :status="r.status" />
              <p v-if="r.reject_reason" class="mt-1 break-words text-xs text-rose-600">เหตุผลที่ไม่อนุมัติ: {{ r.reject_reason }}</p>
            </td>
            <td>
              <div v-if="r.status === 'pending'" class="flex gap-2">
                <button class="btn-primary btn-sm whitespace-nowrap" :disabled="busyId !== null" @click="approve(r)"><Spinner v-if="busyId === r.id" class="h-4 w-4" />อนุมัติ</button>
                <button class="btn-danger btn-sm whitespace-nowrap" :disabled="busyId !== null" @click="askReject(r)">ไม่อนุมัติ</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ReasonModal v-model="showReject" title="ไม่อนุมัติการลา" label="เหตุผลที่ไม่อนุมัติ" confirm-text="ไม่อนุมัติ" :loading="busyId !== null" @confirm="reject" />
  </div>
</template>
