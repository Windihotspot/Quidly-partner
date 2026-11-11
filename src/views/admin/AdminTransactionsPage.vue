<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import TransactionDetailDialog from '@/components/admin/TransactionDetailDialog.vue'
import { adminService } from '@/services/adminService'
import { apiError } from '@/services/eventsService'
import { formatNaira } from '@/lib/eventHelpers'
import { txBadge, txLabel, humanize, fmtDate } from '@/lib/adminHelpers'

const route = useRoute()
const router = useRouter()
const LIMIT = 20
const STATUSES = [
  { label: 'All', value: null },
  { label: 'Successful', value: 'completed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' }
]

const rows = ref([])
const total = ref(0)
const page = ref(1)
const q = ref('')
const status = ref(null)
const dateFrom = ref('')
const dateTo = ref('')
const loading = ref(true)
const error = ref('')
const open = ref(false)
const selectedId = ref(null)
let reqId = 0
let timer

async function load() {
  const id = ++reqId
  loading.value = true
  error.value = ''
  try {
    const res = await adminService.transactions.list({
      page: page.value,
      limit: LIMIT,
      q: q.value.trim() || undefined,
      status: status.value || undefined,
      from: dateFrom.value ? new Date(dateFrom.value + 'T00:00:00').toISOString() : undefined,
      to: dateTo.value ? new Date(dateTo.value + 'T23:59:59.999').toISOString() : undefined
    })
    if (id !== reqId) return
    rows.value = res.data
    total.value = res.total ?? 0
  } catch (e) {
    if (id === reqId) error.value = apiError(e, 'Could not load transactions.')
  } finally {
    if (id === reqId) loading.value = false
  }
}

onMounted(() => {
  load()
  if (route.query.id) view({ id: route.query.id })
})
onBeforeUnmount(() => clearTimeout(timer))
watch([status, dateFrom, dateTo], () => {
  page.value = 1
  load()
})
watch(q, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    page.value = 1
    load()
  }, 350)
})
watch(open, (v) => {
  if (!v && route.query.id) router.replace({ query: {} })
})

const view = (t) => {
  selectedId.value = t.id
  open.value = true
}
const hasFilters = computed(() => q.value || status.value || dateFrom.value || dateTo.value)
const clear = () => {
  q.value = ''
  status.value = null
  dateFrom.value = ''
  dateTo.value = ''
}
const from = computed(() => (total.value ? (page.value - 1) * LIMIT + 1 : 0))
const to = computed(() => Math.min(page.value * LIMIT, total.value))
const go = (p) => {
  page.value = p
  load()
}
const amt = (t) => (Number(t.amount) === 0 ? 'Free' : formatNaira(t.amount))
</script>

<template>
  <MainLayout>
    <div class="dash-container">
      <div class="dash-header">
        <div>
          <h1 class="dash-title">Transactions</h1>
          <p class="dash-subtitle">Every payment across all partners</p>
        </div>
        <v-btn icon="mdi-refresh" variant="text" size="small" :loading="loading" @click="load" />
      </div>

      <div v-if="error" class="error-banner">
        <i class="mdi mdi-alert-circle-outline"></i> {{ error }}
        <button type="button" class="q-link ml-auto" @click="load">Retry</button>
      </div>

      <!-- Filters -->
      <div class="filters">
        <v-text-field
          v-model="q"
          placeholder="Search reference, name or email"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="f-search"
        />
        <v-text-field
          v-model="dateFrom"
          type="date"
          label="From"
          density="compact"
          variant="outlined"
          hide-details
          class="f-date"
        />
        <v-text-field
          v-model="dateTo"
          type="date"
          label="To"
          density="compact"
          variant="outlined"
          hide-details
          class="f-date"
        />
        <button v-if="hasFilters" type="button" class="q-link text-sm" @click="clear">Clear</button>
      </div>
      <div class="period mb-4">
        <button
          v-for="s in STATUSES"
          :key="s.label"
          type="button"
          class="period__btn"
          :class="{ 'period__btn--on': status === s.value }"
          @click="status = s.value"
        >
          {{ s.label }}
        </button>
      </div>

      <div class="panel">
        <div v-if="!rows.length" class="empty">
          <v-progress-circular v-if="loading" indeterminate color="#2b7fff" size="26" />
          <template v-else>
            <i class="mdi mdi-receipt-text-outline"></i>
            <p>No transactions match your filters.</p>
          </template>
        </div>

        <div v-else class="table-wrapper">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Partner / Event</th>
                <th>Amount</th>
                <th>Fee</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody :class="{ dim: loading }">
              <tr v-for="t in rows" :key="t.id" @click="view(t)">
                <td>
                  <code>{{ t.reference }}</code>
                </td>
                <td>
                  <span class="block text-sm font-semibold trunc">{{ t.customer_name }}</span>
                  <span class="block q-help trunc">{{ t.customer_email }}</span>
                </td>
                <td>
                  <span class="block text-sm font-semibold trunc">{{
                    t.partners?.business_name
                  }}</span>
                  <span class="block q-help trunc">{{ t.events?.event_name }}</span>
                </td>
                <td class="amount-cell">
                  {{ amt(t) }}
                  <span v-if="Number(t.refunded_amount) > 0" class="block q-help refund"
                    >−{{ formatNaira(t.refunded_amount) }} refunded</span
                  >
                </td>
                <td class="text-sm">
                  {{ t.platform_fee == null ? '—' : formatNaira(t.platform_fee) }}
                </td>
                <td>
                  <span class="status-badge" :style="txBadge(t.status)">{{
                    txLabel(t.status)
                  }}</span>
                  <span class="block q-help">{{ humanize(t.payment_method) }}</span>
                </td>
                <td class="date-cell">{{ fmtDate(t.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="total" class="pager">
          <span class="q-help"
            >Showing {{ from }}–{{ to }} of {{ total.toLocaleString('en-NG') }}</span
          >
          <div>
            <v-btn
              icon="mdi-chevron-left"
              variant="text"
              size="small"
              :disabled="page <= 1 || loading"
              @click="go(page - 1)"
            />
            <v-btn
              icon="mdi-chevron-right"
              variant="text"
              size="small"
              :disabled="to >= total || loading"
              @click="go(page + 1)"
            />
          </div>
        </div>
      </div>
    </div>

    <TransactionDetailDialog v-model="open" :tx-id="selectedId" />
  </MainLayout>
</template>

<style scoped>
.dash-container {
  width: 100%;
  padding: 24px;
}
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.dash-title {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}
.dash-subtitle {
  font-size: 14px;
  color: #6b7280;
}
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  margin-bottom: 20px;
}
.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.f-search {
  flex: 1 1 260px;
  max-width: 380px;
}
.f-date {
  flex: 0 0 160px;
}
.period {
  display: inline-flex;
  flex-wrap: wrap;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 3px;
}
.period__btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  border-radius: 8px;
  border: 0;
  background: none;
  cursor: pointer;
}
.period__btn--on {
  background: #eaf2ff;
  color: #2b7fff;
}
.panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  overflow: hidden;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 44px 24px;
  color: #9ca3af;
  font-size: 14px;
}
.empty i {
  font-size: 34px;
}
.table-wrapper {
  overflow-x: auto;
}
.orders-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.orders-table thead {
  background: #f9fafb;
}
.orders-table th {
  padding: 12px 18px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9ca3af;
  white-space: nowrap;
}
.orders-table tbody tr {
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.orders-table tbody tr:hover {
  background: #f8f9ff;
}
.orders-table td {
  padding: 12px 18px;
  color: #4b5563;
}
.orders-table code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #2b7fff;
  background: #e3f0ff;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.dim {
  opacity: 0.55;
  transition: opacity 0.15s;
}
.trunc {
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.amount-cell {
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
}
.refund {
  color: #dc2626;
  font-weight: 500;
}
.date-cell {
  color: #9ca3af;
  font-size: 13px;
  white-space: nowrap;
}
.status-badge {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  text-transform: capitalize;
  white-space: nowrap;
  margin-bottom: 2px;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 8px 20px;
  border-top: 1px solid #f3f4f6;
}
@media (max-width: 640px) {
  .dash-container {
    padding: 16px;
  }
  .dash-title {
    font-size: 24px;
  }
  .f-search,
  .f-date {
    flex: 1 1 100%;
    max-width: none;
  }
}
</style>
