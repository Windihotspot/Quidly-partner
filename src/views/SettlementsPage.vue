<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import SettlementDetailDialog from '@/components/settlements/SettlementDetailDialog.vue'
import PayoutAccountDialog from '@/components/events/PayoutAccountDialog.vue'
import { settlementsService } from '@/services/settlementsService'
import { apiError } from '@/services/eventsService'
import { formatNaira } from '@/lib/eventHelpers'

const PAGE = 20
const statusFilter = ref('all')
const data = ref(null)
const rows = ref([])
const hasMore = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const downloading = ref(null)
const detailId = ref(null)
const detailOpen = ref(false)
const payoutOpen = ref(false)
const snackbar = ref({ show: false, text: '' })
let requestId = 0

// pending and processing both read as "processing" to the partner
const STATUS = {
  paid: { label: 'paid', bg: '#e8f5e9', color: '#1b8a3a' },
  pending: { label: 'processing', bg: '#fff3e0', color: '#b45309' },
  processing: { label: 'processing', bg: '#fff3e0', color: '#b45309' },
  failed: { label: 'failed', bg: '#fee2e2', color: '#b91c1c' },
}

async function load({ append = false } = {}) {
  const id = ++requestId
  append ? (loadingMore.value = true) : (loading.value = true)
  error.value = ''
  try {
    const res = await settlementsService.overview({ status: statusFilter.value, limit: PAGE, offset: append ? rows.value.length : 0 })
    if (id !== requestId) return
    data.value = res
    rows.value = append ? [...rows.value, ...res.settlements] : res.settlements
    hasMore.value = res.has_more
  } catch (e) {
    if (id === requestId) error.value = apiError(e, 'Could not load your settlements.')
  } finally {
    if (id === requestId) { loading.value = false; loadingMore.value = false }
  }
}
onMounted(load)
watch(statusFilter, () => load())

const totals = computed(() => data.value?.totals)
const policy = computed(() => data.value?.policy)
const balance = computed(() => data.value?.balance)

const policyLines = computed(() => {
  const p = policy.value
  if (!p) return []
  const lines = [
    p.release === 'after_event'
      ? `Paid ${p.hold_days} day${p.hold_days === 1 ? '' : 's'} after your event ends`
      : `Paid ${p.hold_days} day${p.hold_days === 1 ? '' : 's'} after each sale`,
  ]
  if (p.fee_percent !== null) {
    lines.push(`Platform fee ${p.fee_percent}%${p.fee_flat ? ` + ${formatNaira(p.fee_flat)} per paid ticket` : ''}. Free tickets are never charged`)
  }
  lines.push(`Minimum payout ${formatNaira(p.min_payout)}; smaller balances roll over`)
  return lines
})

const period = (s) => {
  const f = (iso, withYear) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
  return `${f(s.period_start)} – ${f(s.period_end, true)}`
}

function open(s) { detailId.value = s.id; detailOpen.value = true }

async function download(s) {
  downloading.value = s.id
  try {
    const name = await settlementsService.downloadReport(s.id)
    snackbar.value = { show: true, text: `Downloaded ${name}` }
  } catch (e) {
    snackbar.value = { show: true, text: apiError(e) }
  } finally {
    downloading.value = null
  }
}
</script>

<template>
  <MainLayout class="m-4" title="Settlements" subtitle="Track payouts, platform fees, and refunds.">
    <div v-if="error" class="error-banner">
      <i class="mdi mdi-alert-circle-outline"></i> {{ error }}
      <button type="button" class="q-link ml-auto" @click="load()">Retry</button>
    </div>

    <!-- summary -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="summary-card">
        <p class="font-mono text-[10px] uppercase tracking-widest summary-label">Gross volume</p>
        <p class="font-display text-2xl font-bold summary-value mt-1">{{ totals ? formatNaira(totals.gross) : '—' }}</p>
      </div>
      <div class="summary-card">
        <p class="font-mono text-[10px] uppercase tracking-widest summary-label">Platform fees</p>
        <p class="font-display text-2xl font-bold summary-value mt-1">{{ totals ? formatNaira(totals.fees) : '—' }}</p>
      </div>
      <div class="summary-card">
        <p class="font-mono text-[10px] uppercase tracking-widest summary-label">Paid out</p>
        <p class="font-display text-2xl font-bold summary-value mt-1">{{ totals ? formatNaira(totals.paid_net) : '—' }}</p>
        <p v-if="totals?.processing_net" class="sub">{{ formatNaira(totals.processing_net) }} on the way</p>
      </div>
      <div class="summary-card-highlight">
        <p class="font-mono text-[10px] uppercase tracking-widest" style="color: #cfe3ff">Pending balance</p>
        <p class="font-display text-2xl font-bold mt-1">{{ balance ? formatNaira(balance.net) : '—' }}</p>
        <p v-if="balance" class="sub sub--light">{{ balance.transactions }} sale{{ balance.transactions === 1 ? '' : 's' }}, after fees</p>
      </div>
    </div>

    <!-- payout account + policy -->
    <div class="grid gap-4 mb-6 md:grid-cols-2">
      <div class="info-card">
        <div class="flex items-center justify-between mb-2">
          <p class="font-semibold">Payout account</p>
          <button type="button" class="q-link text-sm" @click="payoutOpen = true">{{ data?.payout_account ? 'Change' : 'Add' }}</button>
        </div>
        <template v-if="data?.payout_account">
          <p class="text-sm font-medium">{{ data.payout_account.account_name }}</p>
          <p class="q-help">{{ data.payout_account.bank_name }} · {{ data.payout_account.account_number }}</p>
        </template>
        <p v-else-if="data" class="warn"><i class="mdi mdi-alert-outline"></i> Add a payout account, or we can't pay you.</p>
      </div>
      <div class="info-card">
        <p class="font-semibold mb-2">How payouts work</p>
        <ul class="policy"><li v-for="l in policyLines" :key="l"><i class="mdi mdi-check"></i>{{ l }}</li></ul>
      </div>
    </div>

    <div class="flex justify-end mb-4">
      <v-btn-toggle v-model="statusFilter" mandatory density="compact" class="!rounded-lg filter-toggle">
        <v-btn value="all" size="small">All</v-btn>
        <v-btn value="paid" size="small">Paid</v-btn>
        <v-btn value="processing" size="small">Processing</v-btn>
        <v-btn value="failed" size="small">Failed</v-btn>
      </v-btn-toggle>
    </div>

    <div class="table-card">
      <div v-if="loading" class="py-16 text-center"><v-progress-circular indeterminate color="#2b7fff" /></div>

      <div v-else-if="!rows.length" class="empty">
        <i class="mdi mdi-bank-transfer"></i>
        <p class="font-semibold">{{ statusFilter === 'all' ? 'No settlements yet' : `No ${statusFilter} settlements` }}</p>
        <p class="q-help">Once your ticket sales clear the hold period, your payouts will be listed here.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left table-head font-mono text-[11px] uppercase tracking-wider">
              <th class="px-6 py-3 font-normal">Period</th>
              <th class="py-3 font-normal">Gross</th>
              <th class="py-3 font-normal">Fees</th>
              <th class="py-3 font-normal">Refunds</th>
              <th class="py-3 font-normal">Net</th>
              <th class="py-3 font-normal">Status</th>
              <th class="py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in rows" :key="s.id" class="table-row" @click="open(s)">
              <td class="px-6 py-3 row-emphasis font-medium">
                {{ period(s) }}
                <span class="block font-mono ref">{{ s.reference }}</span>
              </td>
              <td class="py-3 row-body">{{ formatNaira(s.gross) }}</td>
              <td class="py-3 row-body">{{ formatNaira(s.fees) }}</td>
              <td class="py-3 row-body">{{ formatNaira(s.refunds) }}</td>
              <td class="py-3 row-emphasis font-semibold">{{ formatNaira(s.net) }}</td>
              <td class="py-3">
                <span class="status-pill" :style="{ background: STATUS[s.status]?.bg, color: STATUS[s.status]?.color }">{{ STATUS[s.status]?.label }}</span>
              </td>
              <td class="py-3 pr-6 text-right" @click.stop>
                <v-btn size="small" variant="text" class="!text-[#2b7fff]" :loading="downloading === s.id" prepend-icon="mdi-download-outline" @click="download(s)">
                  Report
                </v-btn>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="hasMore" class="text-center py-4">
          <v-btn class="q-btn-ghost" :loading="loadingMore" @click="load({ append: true })">Load more</v-btn>
        </div>
      </div>
    </div>

    <SettlementDetailDialog v-model="detailOpen" :settlement-id="detailId" />
    <PayoutAccountDialog v-model="payoutOpen" @saved="load()" />
    <v-snackbar v-model="snackbar.show" timeout="2600">{{ snackbar.text }}</v-snackbar>
  </MainLayout>
</template>

<style scoped>
.error-banner { display: flex; align-items: center; gap: 8px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 12px; padding: 12px 16px; font-size: 14px; margin-bottom: 20px; }
.summary-card { background: #fff; border-radius: 14px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); padding: 16px 20px; }
.summary-card-highlight { background: #2b7fff; border-radius: 14px; padding: 16px 20px; color: #fff; box-shadow: 0 4px 14px rgba(43, 127, 255, 0.25); }
.summary-label { color: #9ca3af; }
.summary-value { color: #2b3e50; }
.sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.sub--light { color: #cfe3ff; }
.info-card { background: #fff; border-radius: 14px; border: 1px solid rgba(0, 0, 0, 0.05); padding: 16px 20px; }
.warn { color: #b45309; font-size: 14px; }
.policy { display: grid; gap: 6px; font-size: 13px; color: #4b5563; }
.policy i { color: #059669; margin-right: 8px; }
.filter-toggle :deep(.v-btn) { color: #6b7280; }
.filter-toggle :deep(.v-btn--active) { background: #e3f0ff !important; color: #2b7fff !important; }
.table-card { background: #fff; border-radius: 18px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); overflow: hidden; }
.table-head { color: #9ca3af; }
.table-row { border-top: 1px solid rgba(0, 0, 0, 0.05); cursor: pointer; transition: background-color 0.15s ease; }
.table-row:hover { background: #f8f9ff; }
.row-emphasis { color: #2b3e50; }
.row-body { color: #4b5563; }
.ref { font-size: 11px; color: #9ca3af; font-weight: 400; }
.status-pill { font-size: 11px; padding: 2px 10px; border-radius: 999px; font-weight: 600; text-transform: capitalize; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 56px 16px; text-align: center; }
.empty i { font-size: 44px; color: #c7d2e0; }
</style>
