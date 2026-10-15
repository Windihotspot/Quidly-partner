<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import PayoutAccountDialog from '@/components/events/PayoutAccountDialog.vue'
import { dashboardService } from '@/services/dashboardService'
import { apiError } from '@/services/eventsService'
import { formatNaira, formatShortDate } from '@/lib/eventHelpers'

const router = useRouter()

const PERIODS = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: 'All', value: null }
]
const days = ref(30)
const data = ref(null)
const loading = ref(true)
const error = ref('')
const payoutOpen = ref(false)
let requestId = 0

async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const res = await dashboardService.overview(days.value)
    if (id === requestId) data.value = res
  } catch (e) {
    if (id === requestId) error.value = apiError(e, 'Could not load your dashboard.')
  } finally {
    if (id === requestId) loading.value = false
  }
}
onMounted(load)
watch(days, load)

// ---- stat cards ---------------------------------------------------------------
const n = (v) => Number(v ?? 0).toLocaleString('en-NG')
const stats = computed(() => {
  const s = data.value?.stats
  const dash = '—'
  return [
    {
      label: 'Total Payments',
      value: s ? n(s.total_payments) : dash,
      icon: 'mdi-swap-horizontal',
      bgColor: '#e3f0ff',
      textColor: '#2b7fff'
    },
    {
      label: 'Successful',
      value: s ? n(s.successful) : dash,
      icon: 'mdi-check-circle-outline',
      bgColor: '#ecfdf5',
      textColor: '#059669'
    },
    {
  label: 'Pending',
  value: s ? n(s.pending) : dash,
  icon: 'mdi-clock-outline',
  bgColor: '#fffbeb',
  textColor: '#d97706'
},
    {
      label: 'Failed',
      value: s ? n(s.failed) : dash,
      icon: 'mdi-close-circle-outline',
      bgColor: '#fef2f2',
      textColor: '#dc2626'
    },
    {
      label: 'Tickets Sold',
      value: s ? n(s.tickets_sold) : dash,
      icon: 'mdi-ticket-confirmation-outline',
      bgColor: '#fef3c7',
      textColor: '#d97706'
    },
    {
      label: 'Revenue',
      value: s ? formatNaira(s.revenue) : dash,
      icon: 'mdi-cash-multiple',
      bgColor: '#e0f2fe',
      textColor: '#0284c7',
      wide: true
    }
  ]
})

// ---- orders -------------------------------------------------------------------
const STATUS_LABEL = {
  completed: 'successful',
  failed: 'failed',
  pending: 'pending',
  processing: 'pending',
  cancelled: 'cancelled'
}
const statusStyles = {
  successful: { text: '#059669', badge: '#d1fae5', border: '#a7f3d0' },
  failed: { text: '#dc2626', badge: '#fee2e2', border: '#fecaca' },
  pending: { text: '#d97706', badge: '#fef3c7', border: '#fcd34d' },
  cancelled: { text: '#6b7280', badge: '#e5e7eb', border: '#d1d5db' }
}
const label = (s) => STATUS_LABEL[s] ?? s
const style = (s) => statusStyles[label(s)] ?? statusStyles.cancelled
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
const orderTitle = (o) =>
  o.event_name ? `${o.event_name}${o.ticket_name ? ` · ${o.ticket_name}` : ''}` : '—'

// ---- upcoming events --------------------------------------------------------
const pct = (e) =>
  e.capacity ? Math.min(100, Math.round((e.tickets_sold / e.capacity) * 100)) : null
const soldLabel = (e) => `${e.tickets_sold} / ${e.capacity ?? '∞'} sold`

// ---- API keys -----------------------------------------------------------------
function timeAgo(iso) {
  if (!iso) return 'Never used'
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso)) / 1000))
  const units = [
    ['d', 86400],
    ['h', 3600],
    ['m', 60]
  ]
  for (const [u, sec] of units) if (s >= sec) return `Used ${Math.floor(s / sec)}${u} ago`
  return 'Used just now'
}

// ---- getting started ------------------------------------------------------------
const setup = computed(() => {
  const o = data.value?.onboarding
  if (!o) return []
  return [
    {
      key: 'kyc',
      label: 'Verify your business',
      hint: 'Needed before you can receive payouts',
      done: o.kyc_status === 'approved',
      to: '/kyc'
    },
    {
      key: 'payout',
      label: 'Add an NGN payout account',
      hint: 'Where your ticket sales are paid out',
      done: o.has_payout,
      action: 'payout'
    },
    {
      key: 'event',
      label: 'Create your first event',
      hint: 'Set up details, image and tickets',
      done: o.has_event,
      to: { name: 'event-new' }
    },
    {
      key: 'publish',
      label: 'Publish an event',
      hint: 'Make it live so people can buy tickets',
      done: o.has_published_event,
      to: { name: 'events' }
    },
    // {
    //   key: 'api',
    //   label: 'Create an API key',
    //   hint: 'To embed the payment widget on your own site',
    //   done: o.has_api_key,
    //   to: '/api-keys'
    // }
  ]
})
const doneCount = computed(() => setup.value.filter((s) => s.done).length)
const showSetup = computed(() => setup.value.length && doneCount.value < setup.value.length)

function runStep(step) {
  if (step.action === 'payout') payoutOpen.value = true
  else router.push(step.to)
}
</script>

<template>
  <MainLayout>
    <div class="dash-container">
      <!-- Header -->
      <div class="dash-header">
        <div>
          <h1 class="dash-title">Overview</h1>
          <p class="dash-subtitle">Real-time snapshot of your ticket payment activity</p>
        </div>
        <div class="header-actions">
          <div class="period">
            <button
              v-for="p in PERIODS"
              :key="p.label"
              type="button"
              class="period__btn"
              :class="{ 'period__btn--on': days === p.value }"
              @click="days = p.value"
            >
              {{ p.label }}
            </button>
          </div>
          <v-btn icon="mdi-refresh" variant="text" size="small" :loading="loading" @click="load" />
          <v-btn
            class="q-btn-primary"
            prepend-icon="mdi-plus"
            @click="router.push({ name: 'event-new' })"
            >Create event</v-btn
          >
        </div>
      </div>

      <div v-if="error" class="error-banner">
        <i class="mdi mdi-alert-circle-outline"></i> {{ error }}
        <button type="button" class="q-link ml-auto" @click="load">Retry</button>
      </div>

      <!-- Getting started -->
      <div v-if="showSetup" class="setup-card">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="card-title">Get started</h2>
            <p class="q-help">{{ doneCount }} of {{ setup.length }} steps complete</p>
          </div>
          <div class="setup-bar">
            <span :style="{ width: (doneCount / setup.length) * 100 + '%' }"></span>
          </div>
        </div>
        <div class="setup-grid">
          <button
            v-for="s in setup"
            :key="s.key"
            type="button"
            class="setup-item"
            :class="{ 'setup-item--done': s.done }"
            :disabled="s.done"
            @click="runStep(s)"
          >
            <i class="mdi" :class="s.done ? 'mdi-check-circle' : 'mdi-circle-outline'"></i>
            <span class="text-left">
              <span class="block font-semibold text-sm">{{ s.label }}</span>
              <span class="block q-help">{{ s.hint }}</span>
            </span>
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="stat-card"
          :class="{ 'stat-card-wide': stat.wide }"
        >
          <div class="stat-header">
            <span class="stat-label">{{ stat.label }}</span>
            <div class="stat-icon" :style="{ background: stat.bgColor }">
              <i class="mdi" :class="stat.icon" :style="{ color: stat.textColor }"></i>
            </div>
          </div>
          <p class="stat-value" :class="{ 'stat-value--loading': loading && !data }">
            {{ stat.value }}
          </p>
        </div>
      </div>

      <div class="">
        <!-- Upcoming events -->
        <div class="side-card">
          <div class="card-header card-header--tight">
            <h2 class="card-title card-title--sm">Upcoming events</h2>
            <RouterLink to="/events" class="view-link"
              >All <i class="mdi mdi-arrow-right"></i
            ></RouterLink>
          </div>
          <div v-if="loading && !data" class="empty empty--sm">
            <v-progress-circular indeterminate color="#2b7fff" size="22" />
          </div>
          <div v-else-if="!data?.upcoming_events.length" class="empty empty--sm">
            <p>No live upcoming events.</p>
            <RouterLink :to="{ name: 'event-new' }" class="q-link text-sm">Create one</RouterLink>
          </div>
          <ul v-else class="ev-list">
            <li v-for="e in data.upcoming_events" :key="e.id">
              <button
                type="button"
                class="ev-row"
                @click="router.push({ name: 'event-edit', params: { id: e.id, step: 'details' } })"
              >
                <span class="ev-thumb">
                  <img v-if="e.banner_url" :src="e.banner_url" alt="" />
                  <i v-else class="mdi mdi-calendar-outline"></i>
                </span>
                <span class="min-w-0 flex-1 text-left">
                  <span class="block text-sm font-semibold trunc">{{ e.event_name }}</span>
                  <span class="block q-help"
                    >{{ formatShortDate(e.starts_at, e.timezone) }} · {{ soldLabel(e) }}</span
                  >
                  <span v-if="pct(e) !== null" class="bar"
                    ><span :style="{ width: pct(e) + '%' }"></span
                  ></span>
                </span>
              </button>
            </li>
          </ul>
        </div>
        <!-- Recent orders -->
        <div class="orders-card mt-6">
          <div class="card-header">
            <h2 class="card-title">Recent Orders</h2>
          </div>

          <div v-if="loading && !data" class="empty">
            <v-progress-circular indeterminate color="#2b7fff" size="28" />
          </div>
          <div v-else-if="!data?.recent_orders.length" class="empty">
            <i class="mdi mdi-receipt-text-outline"></i>
            <p>No orders yet. They'll appear here as soon as someone buys a ticket.</p>
          </div>

          <div v-else class="orders-content">
            <!-- Desktop table -->
            <div class="table-wrapper desktop-orders">
              <table class="orders-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Event</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="o in data.recent_orders" :key="o.reference">
                    <td class="ref-cell">
                      <code>{{ o.reference }}</code>
                    </td>
                    <td class="name-cell">{{ o.customer }}</td>
                    <td class="event-cell">
                      <span class="trunc">{{ orderTitle(o) }}</span>
                      <span v-if="o.quantity > 1" class="qty">×{{ o.quantity }}</span>
                    </td>
                    <td class="amount-cell">
                      {{ Number(o.amount) === 0 ? 'Free' : formatNaira(o.amount) }}
                    </td>
                    <td class="status-cell">
                      <span
                        class="status-badge"
                        :style="{
                          background: style(o.status).badge,
                          color: style(o.status).text,
                          borderColor: style(o.status).border
                        }"
                      >
                        {{ label(o.status) }}
                      </span>
                    </td>
                    <td class="date-cell">{{ formatDate(o.created_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile order cards -->
            <div class="mobile-orders">
              <article v-for="o in data.recent_orders" :key="o.reference" class="order-mobile-card">
                <div class="order-mobile-top">
                  <div class="order-mobile-event">
                    <p class="order-mobile-title">{{ orderTitle(o) }}</p>
                    <code class="order-mobile-reference">{{ o.reference }}</code>
                  </div>

                  <span
                    class="status-badge"
                    :style="{
                      background: style(o.status).badge,
                      color: style(o.status).text,
                      borderColor: style(o.status).border
                    }"
                  >
                    {{ label(o.status) }}
                  </span>
                </div>

                <div class="order-mobile-bottom">
                  <div class="order-mobile-customer">
                    <span class="order-mobile-label">Customer</span>
                    <span class="order-mobile-value">{{ o.customer || '—' }}</span>
                  </div>

                  <div class="order-mobile-amount">
                    <span class="order-mobile-label">Amount</span>
                    <span class="order-mobile-value">
                      {{ Number(o.amount) === 0 ? 'Free' : formatNaira(o.amount) }}
                      <small v-if="o.quantity > 1" class="order-mobile-quantity">
                        ×{{ o.quantity }}
                      </small>
                    </span>
                  </div>
                </div>

                <div class="order-mobile-date">
                  <i class="mdi mdi-calendar-clock-outline"></i>
                  {{ formatDate(o.created_at) }}
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>

    <PayoutAccountDialog v-model="payoutOpen" @saved="load" />
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
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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

.period {
  display: inline-flex;
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

.setup-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 24px;
}
.setup-bar {
  width: 160px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 99px;
  overflow: hidden;
}
.setup-bar span {
  display: block;
  height: 100%;
  background: #2b7fff;
  border-radius: 99px;
  transition: width 0.3s ease;
}
.setup-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}
.setup-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #9ca3af;
}
.setup-item:hover:not(:disabled) {
  border-color: #2b7fff;
  background: #f5f9ff;
}
.setup-item i {
  font-size: 20px;
  margin-top: 1px;
}
.setup-item .font-semibold {
  color: #1f2937;
}
.setup-item--done {
  background: #f9fafb;
  cursor: default;
}
.setup-item--done i {
  color: #059669;
}
.setup-item--done .font-semibold {
  color: #9ca3af;
  text-decoration: line-through;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}
.stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.stat-card:hover {
  border-color: #2b7fff;
  box-shadow: 0 4px 12px rgba(43, 127, 255, 0.1);
  transform: translateY(-2px);
}
.stat-card-wide {
  grid-column: span 2;
}
.stat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.stat-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9ca3af;
}
.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.2;
}
.stat-value--loading {
  color: #d1d5db;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 24px;
  align-items: start;
}
.side-col {
  display: grid;
  gap: 24px;
}

.orders-card,
.side-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  overflow: hidden;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
}
.card-header--tight {
  padding: 16px 20px;
}
.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.card-title--sm {
  font-size: 15px;
}
.view-link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
  text-decoration: none;
  transition: all 0.2s ease;
}
.view-link:hover {
  color: #2b7fff;
  gap: 10px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 44px 24px;
  color: #9ca3af;
  font-size: 14px;
  text-align: center;
}
.empty i {
  font-size: 34px;
}
.empty--sm {
  padding: 24px 16px;
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
  padding: 12px 20px;
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
  transition: background-color 0.2s ease;
}
.orders-table tbody tr:hover {
  background: #f8f9ff;
}
.orders-table td {
  padding: 14px 20px;
  color: #4b5563;
}
.ref-cell code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #2b7fff;
  background: #e3f0ff;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
  white-space: nowrap;
}
.event-cell {
  max-width: 220px;
}
.trunc {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.qty {
  margin-left: 6px;
  font-size: 12px;
  color: #9ca3af;
}
.amount-cell {
  font-weight: 600;
  color: #1f2937;
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
}
.date-cell {
  color: #9ca3af;
  font-size: 13px;
  white-space: nowrap;
}

.ev-list {
  list-style: none;
  margin: 0;
  padding: 6px;
}
.ev-row {
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px;
  border-radius: 10px;
  background: none;
  border: 0;
  cursor: pointer;
}
.ev-row:hover {
  background: #f5f9ff;
}
.ev-thumb {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #fff3e0;
  color: #b45309;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.ev-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.bar {
  display: block;
  height: 4px;
  background: #e5e7eb;
  border-radius: 99px;
  margin-top: 6px;
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: #2b7fff;
}

.api-card {
  background: linear-gradient(135deg, #2b7fff 0%, #1e5fb8 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  padding: 24px;
  color: #fff;
  display: flex;
  flex-direction: column;
}
.api-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.api-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}
.api-badge {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.api-key-container {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.api-key {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  word-break: break-all;
}
.env {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.18);
}
.env--live {
  background: #fff;
  color: #1e5fb8;
}
.used {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}
.api-note {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin: 2px 0 12px;
}
.api-empty {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 14px;
}
.manage-link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: all 0.2s ease;
}
.manage-link:hover {
  color: #fff;
  gap: 10px;
}

/* Desktop and mobile order layouts */
.orders-content {
  width: 100%;
  min-width: 0;
}

.desktop-orders {
  display: block;
}

.mobile-orders {
  display: none;
}

/* Mobile order cards */
.order-mobile-card {
  min-width: 0;
  padding: 16px;
  background: #fff;
  border: 1px solid #edf0f5;
  border-radius: 14px;
  transition: border-color 0.2s ease;
}

.order-mobile-card + .order-mobile-card {
  margin-top: 12px;
}

.order-mobile-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
}

.order-mobile-event {
  flex: 1 1 auto;
  min-width: 0;
}

.order-mobile-title {
  margin: 0 0 6px;
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.order-mobile-reference {
  display: inline-block;
  max-width: 100%;
  color: #2b7fff;
  background: #eff6ff;
  padding: 4px 7px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 10px;
  overflow-wrap: anywhere;
  white-space: normal;
}

.order-mobile-top .status-badge {
  flex-shrink: 0;
  padding: 4px 8px;
  font-size: 10px;
  white-space: nowrap;
}

.order-mobile-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 14px 0;
}

.order-mobile-customer,
.order-mobile-amount {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.order-mobile-amount {
  align-items: flex-end;
  text-align: right;
}

.order-mobile-label {
  color: #9ca3af;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.order-mobile-value {
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.order-mobile-amount .order-mobile-value {
  color: #1f2937;
  font-size: 15px;
}

.order-mobile-quantity {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 500;
}

.order-mobile-date {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
  color: #9ca3af;
  font-size: 11px;
}

.order-mobile-date i {
  font-size: 15px;
  color: #2b7fff;
}

/* Responsive switch */
@media (max-width: 640px) {
  .desktop-orders {
    display: none;
  }

  .mobile-orders {
    display: block;
    padding: 12px;
  }

  .orders-card .card-header {
    padding: 16px;
  }

  .order-mobile-card {
    padding: 14px;
  }
}

/* Extra-small phones */
@media (max-width: 360px) {
  .mobile-orders {
    padding: 8px;
  }

  .order-mobile-card {
    padding: 12px;
  }

  .order-mobile-top {
    gap: 8px;
  }

  .order-mobile-top .status-badge {
    font-size: 9px;
    padding: 4px 6px;
  }

  .order-mobile-bottom {
    gap: 8px;
  }

  .order-mobile-amount .order-mobile-value {
    font-size: 13px;
  }
}

@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .stat-card-wide {
    grid-column: span 1;
  }
}
@media (max-width: 640px) {
  .dash-container {
    padding: 16px;
  }
  .dash-title {
    font-size: 24px;
  }
  .stat-value {
    font-size: 20px;
  }
  .orders-table th,
  .orders-table td {
    padding: 12px 14px;
  }
}
</style>
