<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import { adminService } from '@/services/adminService'
import { apiError } from '@/services/eventsService'
import { formatNaira } from '@/lib/eventHelpers'

const router = useRouter()
const data = ref(null)
const kyc = ref([])
const txs = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [o, k, t] = await Promise.all([
      adminService.overview(),
      adminService.kyc.queue({ limit: 5 }),
      adminService.transactions.list({ limit: 8 }),
    ])
    data.value = o
    kyc.value = k.data
    txs.value = t.data
  } catch (e) {
    error.value = apiError(e, 'Could not load platform overview.')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const n = (v) => Number(v ?? 0).toLocaleString('en-NG')
const dash = '—'
const stats = computed(() => {
  const d = data.value
  return [
    { label: 'Partners', value: d ? n(d.partners.total) : dash, sub: d && `${n(d.partners.active)} active · ${n(d.partners.pending)} pending`, icon: 'mdi-domain', bg: '#e3f0ff', fg: '#2b7fff' },
    { label: 'Events', value: d ? n(d.events.total) : dash, sub: d && `${n(d.events.published)} published`, icon: 'mdi-calendar-outline', bg: '#fef3c7', fg: '#d97706' },
    { label: 'Completed Sales', value: d ? n(d.sales.count) : dash, icon: 'mdi-check-circle-outline', bg: '#ecfdf5', fg: '#059669' },
    { label: 'Gross Volume', value: d ? formatNaira(d.sales.gross) : dash, icon: 'mdi-cash-multiple', bg: '#e0f2fe', fg: '#0284c7' },
    { label: 'Platform Fees', value: d ? formatNaira(d.sales.fees) : dash, icon: 'mdi-percent-outline', bg: '#ecfdf5', fg: '#059669' },
    { label: 'Refunded', value: d ? formatNaira(d.sales.refunded) : dash, icon: 'mdi-cash-refund', bg: '#fef2f2', fg: '#dc2626' },
  ]
})

const attention = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: 'KYC awaiting review', count: d.kyc_queue, icon: 'mdi-shield-check-outline', to: '/admin/kyc' },
    { label: 'Open settlements', count: d.settlements_open.count, sub: formatNaira(d.settlements_open.net), icon: 'mdi-bank-transfer', to: '/admin/settlements' },
    { label: 'Failed webhooks', count: d.failed_webhooks, icon: 'mdi-webhook', to: '/admin/ops' },
    { label: 'Failed ticket emails', count: d.failed_deliveries, icon: 'mdi-email-alert-outline', to: '/admin/transactions' },
  ]
})

// 30-day chart
const daily = computed(() => data.value?.daily ?? [])
const maxGross = computed(() => Math.max(1, ...daily.value.map((d) => Number(d.gross))))
const barH = (d) => Math.max(4, (Number(d.gross) / maxGross.value) * 100) + '%'
const shortDate = (iso) => new Date(iso).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })

// status helpers
const LABEL = { completed: 'successful', processing: 'pending' }
const STYLES = {
  successful: { text: '#059669', badge: '#d1fae5', border: '#a7f3d0' },
  failed: { text: '#dc2626', badge: '#fee2e2', border: '#fecaca' },
  pending: { text: '#d97706', badge: '#fef3c7', border: '#fcd34d' },
  cancelled: { text: '#6b7280', badge: '#e5e7eb', border: '#d1d5db' },
}
const label = (s) => LABEL[s] ?? s
const badge = (s) => {
  const c = STYLES[label(s)] ?? STYLES.cancelled
  return { background: c.badge, color: c.text, borderColor: c.border }
}
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
</script>

<template>
  <MainLayout>
    <div class="dash-container">
      <div class="dash-header">
        <div>
          <h1 class="dash-title">Platform Overview</h1>
          <p class="dash-subtitle">Everything happening across all partners</p>
        </div>
        <v-btn icon="mdi-refresh" variant="text" size="small" :loading="loading" @click="load" />
      </div>

      <div v-if="error" class="error-banner">
        <i class="mdi mdi-alert-circle-outline"></i> {{ error }}
        <button type="button" class="q-link ml-auto" @click="load">Retry</button>
      </div>

      <!-- Needs attention -->
      <div class="attn-grid">
        <button
          v-for="a in attention"
          :key="a.label"
          type="button"
          class="attn"
          :class="{ 'attn--hot': a.count > 0 }"
          @click="router.push(a.to)"
        >
          <i class="mdi" :class="a.icon"></i>
          <span class="text-left">
            <span class="attn-count">{{ n(a.count) }}</span>
            <span class="block q-help">{{ a.label }}<template v-if="a.sub"> · {{ a.sub }}</template></span>
          </span>
        </button>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div v-for="s in stats" :key="s.label" class="stat-card">
          <div class="stat-header">
            <span class="stat-label">{{ s.label }}</span>
            <div class="stat-icon" :style="{ background: s.bg }">
              <i class="mdi" :class="s.icon" :style="{ color: s.fg }"></i>
            </div>
          </div>
          <p class="stat-value" :class="{ 'stat-value--loading': loading && !data }">{{ s.value }}</p>
          <p v-if="s.sub" class="q-help">{{ s.sub }}</p>
        </div>
      </div>

      <!-- Sales chart -->
      <div class="panel mb-6">
        <div class="card-header"><h2 class="card-title">Gross volume · last 30 days</h2></div>
        <div v-if="!daily.length" class="empty">
          <v-progress-circular v-if="loading" indeterminate color="#2b7fff" size="24" />
          <p v-else>No completed sales in the last 30 days.</p>
        </div>
        <div v-else class="chart-wrap">
          <div class="chart">
            <div
              v-for="d in daily"
              :key="d.dt"
              class="chart-bar"
              :style="{ height: barH(d) }"
              :title="`${shortDate(d.dt)} · ${formatNaira(d.gross)} · ${d.n} sale(s)`"
            ></div>
          </div>
          <div class="chart-axis">
            <span>{{ shortDate(daily[0].dt) }}</span>
            <span>{{ shortDate(daily[daily.length - 1].dt) }}</span>
          </div>
        </div>
      </div>

      <div class="two-col">
        <!-- KYC queue -->
        <div class="panel">
          <div class="card-header">
            <h2 class="card-title card-title--sm">KYC queue</h2>
            <RouterLink to="/admin/kyc" class="view-link">All <i class="mdi mdi-arrow-right"></i></RouterLink>
          </div>
          <div v-if="!kyc.length" class="empty"><p>{{ loading ? 'Loading…' : 'Nothing waiting for review.' }}</p></div>
          <ul v-else class="q-list">
            <li v-for="k in kyc" :key="k.id">
              <button type="button" class="q-row" @click="router.push({ path: '/admin/kyc', query: { partner: k.partner_id } })">
                <span class="q-avatar">{{ (k.partners?.business_name || '?')[0] }}</span>
                <span class="min-w-0 flex-1 text-left">
                  <span class="block text-sm font-semibold trunc">{{ k.partners?.business_name }}</span>
                  <span class="block q-help">{{ k.partners?.email }} · {{ fmtDate(k.created_at) }}</span>
                </span>
                <span class="status-badge" :style="badge('pending')">{{ k.status.replace('_', ' ') }}</span>
              </button>
            </li>
          </ul>
        </div>

        <!-- Recent transactions -->
        <div class="panel">
          <div class="card-header">
            <h2 class="card-title card-title--sm">Recent transactions</h2>
            <RouterLink to="/admin/transactions" class="view-link">All <i class="mdi mdi-arrow-right"></i></RouterLink>
          </div>
          <div v-if="!txs.length" class="empty"><p>{{ loading ? 'Loading…' : 'No transactions yet.' }}</p></div>
          <div v-else class="table-wrapper">
            <table class="orders-table">
              <thead>
                <tr><th>Reference</th><th>Partner / Event</th><th>Amount</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                <tr v-for="t in txs" :key="t.id" @click="router.push({ path: '/admin/transactions', query: { id: t.id } })">
                  <td><code>{{ t.reference }}</code></td>
                  <td>
                    <span class="block text-sm font-semibold trunc">{{ t.partners?.business_name }}</span>
                    <span class="block q-help trunc">{{ t.events?.event_name }}</span>
                  </td>
                  <td class="amount-cell">{{ Number(t.amount) === 0 ? 'Free' : formatNaira(t.amount) }}</td>
                  <td><span class="status-badge" :style="badge(t.status)">{{ label(t.status) }}</span></td>
                  <td class="date-cell">{{ fmtDate(t.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </MainLayout>
</template>

<style scoped>
.dash-container { width: 100%; padding: 24px; }
.dash-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
.dash-title { font-size: 28px; font-weight: 700; color: #1f2937; letter-spacing: -0.02em; margin-bottom: 8px; }
.dash-subtitle { font-size: 14px; color: #6b7280; }
.error-banner { display: flex; align-items: center; gap: 8px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 12px; padding: 12px 16px; font-size: 14px; margin-bottom: 20px; }

.attn-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px; }
.attn { display: flex; gap: 12px; align-items: center; padding: 14px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; cursor: pointer; color: #9ca3af; transition: all 0.15s ease; }
.attn:hover { border-color: #2b7fff; background: #f5f9ff; }
.attn i { font-size: 22px; }
.attn-count { font-size: 20px; font-weight: 700; color: #1f2937; }
.attn--hot { border-color: #fcd34d; background: #fffbeb; }
.attn--hot i, .attn--hot .attn-count { color: #d97706; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.stat-card:hover { border-color: #2b7fff; box-shadow: 0 4px 12px rgba(43, 127, 255, 0.1); transform: translateY(-2px); }
.stat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.stat-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #9ca3af; }
.stat-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.stat-value { font-size: 24px; font-weight: 700; color: #1f2937; line-height: 1.2; }
.stat-value--loading { color: #d1d5db; }

.panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; min-width: 0; }
.two-col { display: grid; grid-template-columns: 360px 1fr; gap: 24px; align-items: start; }
.card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #f3f4f6; }
.card-title { font-size: 18px; font-weight: 600; color: #1f2937; }
.card-title--sm { font-size: 15px; }
.view-link { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: #9ca3af; text-decoration: none; transition: all 0.2s ease; }
.view-link:hover { color: #2b7fff; gap: 10px; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 32px 16px; color: #9ca3af; font-size: 14px; text-align: center; }

.chart-wrap { padding: 20px 24px 14px; }
.chart { display: flex; align-items: flex-end; gap: 4px; height: 140px; }
.chart-bar { flex: 1; background: #2b7fff; opacity: 0.85; border-radius: 4px 4px 0 0; min-width: 3px; transition: opacity 0.15s; }
.chart-bar:hover { opacity: 1; }
.chart-axis { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #9ca3af; }

.q-list { list-style: none; margin: 0; padding: 6px; }
.q-row { width: 100%; display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 10px; background: none; border: 0; cursor: pointer; }
.q-row:hover { background: #f5f9ff; }
.q-avatar { width: 38px; height: 38px; border-radius: 10px; background: #e3f0ff; color: #2b7fff; font-weight: 700; display: flex; align-items: center; justify-content: center; text-transform: uppercase; flex-shrink: 0; }

.table-wrapper { overflow-x: auto; }
.orders-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.orders-table thead { background: #f9fafb; }
.orders-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #9ca3af; white-space: nowrap; }
.orders-table tbody tr { border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background-color 0.2s ease; }
.orders-table tbody tr:hover { background: #f8f9ff; }
.orders-table td { padding: 12px 16px; color: #4b5563; }
.orders-table code { font-family: 'Courier New', monospace; font-size: 12px; color: #2b7fff; background: #e3f0ff; padding: 4px 8px; border-radius: 6px; white-space: nowrap; }
.trunc { display: block; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.amount-cell { font-weight: 600; color: #1f2937; white-space: nowrap; }
.date-cell { color: #9ca3af; font-size: 13px; white-space: nowrap; }
.status-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid; text-transform: capitalize; white-space: nowrap; }

@media (max-width: 1200px) { .two-col { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .dash-container { padding: 16px; }
  .dash-title { font-size: 24px; }
  .stat-value { font-size: 20px; }
}
</style>