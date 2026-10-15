<script setup>
import { computed } from 'vue'
import MainLayout from '@/layouts/MainLayout.vue'
import { useOrders } from '@/composables/useOrders'
import { formatNaira } from '@/lib/eventHelpers'

const {
  orders,
  total,
  loading,
  error,
  search,
  status,
  days,
  page,
  pageSize,
  totalPages,
  filteredOrders,
  selectedOrder,
  drawerOpen,
  refresh,
  setPage,
  openOrder,
  closeOrder,
} = useOrders()

const STATUS_LABEL = {
  completed: 'Successful',
  failed: 'Failed',
  pending: 'Pending',
  processing: 'Processing',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

const statusStyles = {
  completed: { color: '#047857', bg: '#d1fae5' },
  failed: { color: '#b91c1c', bg: '#fee2e2' },
  pending: { color: '#b45309', bg: '#fef3c7' },
  processing: { color: '#1d4ed8', bg: '#dbeafe' },
  cancelled: { color: '#4b5563', bg: '#e5e7eb' },
  refunded: { color: '#6d28d9', bg: '#ede9fe' },
}

const countStatus = (value) =>
  orders.value.filter(
    (o) => String(o.transaction?.status ?? '').toLowerCase() === value,
  ).length

const successfulRevenue = computed(() =>
  orders.value.reduce((sum, order) => {
    const tx = order.transaction ?? {}
    return tx.status === 'completed'
      ? sum + Number(tx.amount ?? 0)
      : sum
  }, 0),
)

const summary = computed(() => [
  {
    label: 'Total orders',
    value: Number(total.value).toLocaleString('en-NG'),
    icon: 'mdi-receipt-text-outline',
    color: '#2563eb',
    bg: '#dbeafe',
  },
  {
    label: 'Successful on page',
    value: countStatus('completed').toLocaleString('en-NG'),
    icon: 'mdi-check-circle-outline',
    color: '#059669',
    bg: '#d1fae5',
  },
  {
    label: 'Pending on page',
    value: (
      countStatus('pending') + countStatus('processing')
    ).toLocaleString('en-NG'),
    icon: 'mdi-clock-outline',
    color: '#d97706',
    bg: '#fef3c7',
  },
  {
    label: 'Page revenue',
    value: formatNaira(successfulRevenue.value),
    icon: 'mdi-cash-multiple',
    color: '#0284c7',
    bg: '#e0f2fe',
  },
])

function transaction(order) {
  return order?.transaction ?? {}
}

function eventName(order) {
  return order?.event?.event_name ?? 'Unknown event'
}

function customerName(order) {
  const tx = transaction(order)
  return tx.customer_name || tx.customer_email || 'Unknown customer'
}

function ticketName(order) {
  return order?.ticket_type?.name
    ?? order?.transaction?.metadata?.ticket_name
    ?? 'Ticket'
}

function labelFor(statusValue) {
  const key = String(statusValue ?? '').toLowerCase()
  return STATUS_LABEL[key] ?? (key.replaceAll('_', ' ') || 'Unknown')
}
function styleFor(statusValue) {
  const key = String(statusValue ?? '').toLowerCase()
  return statusStyles[key] ?? { color: '#4b5563', bg: '#e5e7eb' }
}

function date(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

function money(amount, currency = 'NGN') {
  const value = Number(amount ?? 0)
  if (value === 0) return 'Free'

  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString('en-NG')}`
  }
}

function pretty(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function entries(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).filter(([, v]) => v !== null && v !== undefined)
}

function ticketId(item) {
  return item?.ticket?.id ?? item?.id ?? Math.random()
}

function deliveryStatus(item) {
  return item?.status ?? item?.delivery_status ?? item?.event_type ?? 'Logged'
}
</script>

<template>
  <MainLayout>
    <div class="orders-page">
      <header class="page-header">
        <div>
          <h1>Orders</h1>
          <p>View transactions, ticket records, delivery logs and payment details.</p>
        </div>

        <v-btn
          variant="outlined"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="refresh"
        >
          Refresh
        </v-btn>
      </header>

      <div v-if="error" class="error-banner">
        <i class="mdi mdi-alert-circle-outline" />
        <span>{{ error }}</span>
        <button class="retry-link" type="button" @click="refresh">Retry</button>
      </div>

      <section class="summary-grid">
        <article v-for="item in summary" :key="item.label" class="summary-card">
          <div>
            <p>{{ item.label }}</p>
            <h2>{{ item.value }}</h2>
          </div>
          <span class="summary-icon" :style="{ background: item.bg, color: item.color }">
            <i class="mdi" :class="item.icon" />
          </span>
        </article>
      </section>

      <section class="orders-panel">
        <div class="panel-heading">
          <div>
            <h2>All orders</h2>
            <p>{{ total.toLocaleString('en-NG') }} transactions</p>
          </div>
        </div>

        <div class="filters">
          <div class="search-box">
            <i class="mdi mdi-magnify" />
            <input
              v-model="search"
              type="search"
              placeholder="Search reference, customer or event..."
              aria-label="Search orders"
            />
            <button
              v-if="search"
              type="button"
              aria-label="Clear search"
              @click="search = ''"
            >
              <i class="mdi mdi-close" />
            </button>
          </div>

          <select v-model="status" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="completed">Successful</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>

          <select v-model="days" aria-label="Filter by date">
            <option :value="7">Last 7 days</option>
            <option :value="30">Last 30 days</option>
            <option :value="90">Last 90 days</option>
            <option :value="null">All time</option>
          </select>
        </div>

        <div v-if="loading && !orders.length" class="state-block">
          <v-progress-circular indeterminate color="#2b7fff" size="30" />
          <p>Loading orders...</p>
        </div>

        <div v-else-if="!filteredOrders.length" class="state-block">
          <i class="mdi mdi-receipt-text-outline empty-icon" />
          <h3>No orders found</h3>
          <p>
            {{ search || status !== 'all'
              ? 'Try changing your search or filters.'
              : 'Orders will appear here when customers make purchases.' }}
          </p>
          <button
            v-if="search || status !== 'all'"
            type="button"
            class="clear-filters"
            @click="search = ''; status = 'all'"
          >
            Clear filters
          </button>
        </div>

        <template v-else>
          <div class="table-scroll desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Event / Ticket</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="order in filteredOrders"
                  :key="transaction(order).id || transaction(order).reference"
                  class="order-row"
                  @click="openOrder(order)"
                >
                  <td>
                    <code class="reference">{{ transaction(order).reference || '—' }}</code>
                  </td>
                  <td>
                    <strong>{{ customerName(order) }}</strong>
                    <small>{{ transaction(order).customer_email || '' }}</small>
                  </td>
                  <td>
                    <strong class="event-title">{{ eventName(order) }}</strong>
                    <small>{{ ticketName(order) }}</small>
                  </td>
                  <td>{{ transaction(order).quantity ?? order.tickets?.length ?? 0 }}</td>
                  <td class="amount">
                    {{ money(transaction(order).amount, transaction(order).currency) }}
                  </td>
                  <td>
                    <span
                      class="status-badge"
                      :style="{
                        color: styleFor(transaction(order).status).color,
                        background: styleFor(transaction(order).status).bg,
                      }"
                    >
                      {{ labelFor(transaction(order).status) }}
                    </span>
                  </td>
                  <td class="date-cell">{{ date(transaction(order).created_at) }}</td>
                  <td>
                    <button
                      class="details-button"
                      type="button"
                      aria-label="View order details"
                      @click.stop="openOrder(order)"
                    >
                      <i class="mdi mdi-chevron-right" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mobile-list">
            <button
              v-for="order in filteredOrders"
              :key="transaction(order).id || transaction(order).reference"
              class="mobile-order"
              type="button"
              @click="openOrder(order)"
            >
              <div class="mobile-order-top">
                <div class="mobile-order-info">
                  <strong>{{ eventName(order) }}</strong>
                  <code>{{ transaction(order).reference || '—' }}</code>
                </div>
                <span
                  class="status-badge"
                  :style="{
                    color: styleFor(transaction(order).status).color,
                    background: styleFor(transaction(order).status).bg,
                  }"
                >
                  {{ labelFor(transaction(order).status) }}
                </span>
              </div>
              <div class="mobile-order-middle">
                <span>{{ customerName(order) }}</span>
                <strong>{{ money(transaction(order).amount, transaction(order).currency) }}</strong>
              </div>
              <div class="mobile-order-bottom">
                <span>{{ ticketName(order) }} · Qty {{ transaction(order).quantity ?? 0 }}</span>
                <span>{{ date(transaction(order).created_at) }}</span>
              </div>
            </button>
          </div>
        </template>

        <footer v-if="total > 0" class="pagination">
          <span>
            Showing
            {{ Math.min((page - 1) * pageSize + 1, total) }}–{{ Math.min(page * pageSize, total) }}
            of {{ total }}
          </span>

          <div class="pagination-controls">
            <button
              type="button"
              :disabled="page <= 1 || loading"
              @click="setPage(page - 1)"
            >
              <i class="mdi mdi-chevron-left" />
              Previous
            </button>
            <span>Page {{ page }} of {{ totalPages }}</span>
            <button
              type="button"
              :disabled="page >= totalPages || loading"
              @click="setPage(page + 1)"
            >
              Next
              <i class="mdi mdi-chevron-right" />
            </button>
          </div>
        </footer>
      </section>
    </div>

    <!-- Order details drawer -->
    <Teleport to="body">
      <Transition name="drawer">
        <div
          v-if="drawerOpen && selectedOrder"
          class="drawer-overlay"
          @click.self="closeOrder"
          @keydown.esc="closeOrder"
        >
          <aside
            class="order-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            <header class="drawer-header">
              <div>
                <p class="drawer-eyebrow">ORDER DETAILS</p>
                <h2 id="drawer-title">
                  {{ selectedOrder.transaction?.reference || 'Order details' }}
                </h2>
              </div>
              <button
                type="button"
                class="drawer-close"
                aria-label="Close order details"
                @click="closeOrder"
              >
                <i class="mdi mdi-close" />
              </button>
            </header>

            <div class="drawer-content">
              <section class="detail-hero">
                <span
                  class="status-badge"
                  :style="{
                    color: styleFor(selectedOrder.transaction?.status).color,
                    background: styleFor(selectedOrder.transaction?.status).bg,
                  }"
                >
                  {{ labelFor(selectedOrder.transaction?.status) }}
                </span>
                <h3>
                  {{ money(
                    selectedOrder.transaction?.amount,
                    selectedOrder.transaction?.currency
                  ) }}
                </h3>
                <p>Created {{ date(selectedOrder.transaction?.created_at) }}</p>
              </section>

              <section class="detail-section">
                <h3><i class="mdi mdi-credit-card-outline" /> Transaction</h3>
                <div class="detail-grid">
                  <div class="detail-field">
                    <span>Reference</span>
                    <strong>{{ selectedOrder.transaction?.reference || '—' }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Transaction ID</span>
                    <strong>{{ selectedOrder.transaction?.id || '—' }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Amount</span>
                    <strong>{{ money(selectedOrder.transaction?.amount, selectedOrder.transaction?.currency) }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Quantity</span>
                    <strong>{{ selectedOrder.transaction?.quantity ?? selectedOrder.tickets?.length ?? 0 }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Currency</span>
                    <strong>{{ selectedOrder.transaction?.currency || 'NGN' }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Payment method</span>
                    <strong>{{ selectedOrder.transaction?.payment_method || '—' }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Updated</span>
                    <strong>{{ date(selectedOrder.transaction?.updated_at) }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Failed reason</span>
                    <strong>{{ selectedOrder.transaction?.failed_reason || '—' }}</strong>
                  </div>
                </div>
              </section>

              <section class="detail-section">
                <h3><i class="mdi mdi-account-outline" /> Customer</h3>
                <div class="detail-grid">
                  <div class="detail-field">
                    <span>Name</span>
                    <strong>{{ selectedOrder.transaction?.customer_name || '—' }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Email</span>
                    <strong>{{ selectedOrder.transaction?.customer_email || '—' }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Phone</span>
                    <strong>{{ selectedOrder.transaction?.customer_phone || '—' }}</strong>
                  </div>
                </div>
              </section>

              <section class="detail-section">
                <h3><i class="mdi mdi-calendar-star" /> Event and ticket type</h3>
                <div class="detail-grid">
                  <div class="detail-field">
                    <span>Event</span>
                    <strong>{{ selectedOrder.event?.event_name || '—' }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Event ID</span>
                    <strong>{{ selectedOrder.event?.id || selectedOrder.transaction?.event_id || '—' }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Ticket type</span>
                    <strong>{{ ticketName(selectedOrder) }}</strong>
                  </div>
                  <div class="detail-field">
                    <span>Ticket type ID</span>
                    <strong>{{ selectedOrder.ticket_type?.id || selectedOrder.transaction?.ticket_type_id || '—' }}</strong>
                  </div>
                </div>
              </section>

              <section class="detail-section">
                <h3><i class="mdi mdi-ticket-confirmation-outline" /> Tickets ({{ selectedOrder.tickets?.length ?? 0 }})</h3>
                <div v-if="!selectedOrder.tickets?.length" class="nested-empty">
                  No ticket records found for this transaction.
                </div>
                <article
                  v-for="(item, index) in selectedOrder.tickets || []"
                  :key="ticketId(item)"
                  class="nested-card"
                >
                  <div class="nested-card-heading">
                    <strong>Ticket {{ index + 1 }}</strong>
                    <span class="mini-tag">{{ item.ticket?.status || 'Issued' }}</span>
                  </div>
                  <div class="detail-grid">
                    <div
                      v-for="[key, value] in entries(item.ticket)"
                      :key="key"
                      class="detail-field"
                    >
                      <span>{{ key.replaceAll('_', ' ') }}</span>
                      <strong>{{ pretty(value) }}</strong>
                    </div>
                  </div>

                  <div class="nested-subsection">
                    <h4>Scans ({{ item.scans?.length ?? 0 }})</h4>
                    <div v-if="!item.scans?.length" class="nested-empty">No scans recorded.</div>
                    <div
                      v-for="(scan, scanIndex) in item.scans || []"
                      :key="scan.id || scanIndex"
                      class="log-row"
                    >
                      <div>
                        <strong>{{ scan.status || scan.result || 'Scan' }}</strong>
                        <p>{{ date(scan.scanned_at || scan.created_at) }}</p>
                      </div>
                      <code>{{ scan.id || '' }}</code>
                    </div>
                  </div>
                </article>
              </section>

              <section class="detail-section">
                <h3>
                  <i class="mdi mdi-email-fast-outline" />
                  Ticket deliveries ({{ selectedOrder.ticket_deliveries?.length ?? 0 }})
                </h3>
                <div v-if="!selectedOrder.ticket_deliveries?.length" class="nested-empty">
                  No delivery records found.
                </div>
                <article
                  v-for="(delivery, index) in selectedOrder.ticket_deliveries || []"
                  :key="delivery.id || index"
                  class="nested-card"
                >
                  <div class="nested-card-heading">
                    <strong>{{ deliveryStatus(delivery) }}</strong>
                    <span>{{ date(delivery.created_at || delivery.updated_at) }}</span>
                  </div>
                  <div class="detail-grid">
                    <div
                      v-for="[key, value] in entries(delivery)"
                      :key="key"
                      class="detail-field"
                    >
                      <span>{{ key.replaceAll('_', ' ') }}</span>
                      <strong>{{ pretty(value) }}</strong>
                    </div>
                  </div>
                </article>
              </section>

              <section class="detail-section">
                <h3>
                  <i class="mdi mdi-webhook" />
                  Webhook events ({{ selectedOrder.webhook_events?.length ?? 0 }})
                </h3>
                <div v-if="!selectedOrder.webhook_events?.length" class="nested-empty">
                  No webhook events found.
                </div>
                <article
                  v-for="(item, index) in selectedOrder.webhook_events || []"
                  :key="item.webhook?.id || index"
                  class="nested-card"
                >
                  <div class="nested-card-heading">
                    <strong>
                      {{ item.webhook?.event_type || item.webhook?.event || 'Webhook event' }}
                    </strong>
                    <span>{{ date(item.webhook?.created_at) }}</span>
                  </div>
                  <div class="detail-grid">
                    <div
                      v-for="[key, value] in entries(item.webhook)"
                      :key="key"
                      class="detail-field"
                    >
                      <span>{{ key.replaceAll('_', ' ') }}</span>
                      <strong>{{ pretty(value) }}</strong>
                    </div>
                  </div>
                  <div v-if="item.ticket" class="nested-subsection">
                    <h4>Related ticket</h4>
                    <div class="detail-field">
                      <span>Ticket ID</span>
                      <strong>{{ item.ticket.id }}</strong>
                    </div>
                  </div>
                </article>
              </section>

              <section class="detail-section">
                <h3><i class="mdi mdi-bank-outline" /> Settlement</h3>
                <div v-if="!selectedOrder.settlement" class="nested-empty">
                  No settlement linked to this transaction.
                </div>
                <template v-else>
                  <div class="detail-grid">
                    <div
                      v-for="[key, value] in entries(selectedOrder.settlement.record)"
                      :key="key"
                      class="detail-field"
                    >
                      <span>{{ key.replaceAll('_', ' ') }}</span>
                      <strong>{{ pretty(value) }}</strong>
                    </div>
                  </div>

                  <div v-if="selectedOrder.settlement.bank_account" class="nested-subsection">
                    <h4>Bank account</h4>
                    <div class="detail-grid">
                      <div
                        v-for="[key, value] in entries(selectedOrder.settlement.bank_account)"
                        :key="key"
                        class="detail-field"
                      >
                        <span>{{ key.replaceAll('_', ' ') }}</span>
                        <strong>{{ pretty(value) }}</strong>
                      </div>
                    </div>
                  </div>
                </template>
              </section>

              <section class="detail-section">
                <h3><i class="mdi mdi-code-json" /> Transaction metadata</h3>
                <pre class="metadata-block">{{ pretty(selectedOrder.transaction?.metadata) }}</pre>
              </section>
            </div>

            <footer class="drawer-footer">
              <button type="button" class="drawer-done" @click="closeOrder">
                Close details
              </button>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </MainLayout>
</template>

<style scoped>
.orders-page {
  width: 100%;
  padding: 24px;
  color: #1f2937;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.page-header p {
  color: #6b7280;
  font-size: 14px;
  margin-top: 6px;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 20px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  color: #b91c1c;
  background: #fef2f2;
}

.retry-link,
.clear-filters {
  margin-left: auto;
  color: #2563eb;
  font-weight: 600;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
}

.summary-card p {
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.summary-card h2 {
  margin-top: 9px;
  font-size: clamp(18px, 2vw, 24px);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.summary-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  font-size: 21px;
}

.orders-panel {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  padding: 22px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.panel-heading h2 {
  font-size: 17px;
  font-weight: 700;
}

.panel-heading p {
  color: #9ca3af;
  font-size: 12px;
  margin-top: 4px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 280px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
}

.search-box > i {
  color: #9ca3af;
  font-size: 20px;
}

.search-box input {
  width: 100%;
  min-width: 0;
  height: 40px;
  outline: none;
  font-size: 13px;
}

.search-box button {
  color: #9ca3af;
}

.filters select {
  min-width: 140px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #fff;
  color: #374151;
  font-size: 13px;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

thead {
  background: #f9fafb;
}

th {
  padding: 13px 16px;
  color: #9ca3af;
  font-size: 10px;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

td {
  padding: 15px 16px;
  border-top: 1px solid #f3f4f6;
  color: #4b5563;
  vertical-align: middle;
}

.order-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.order-row:hover {
  background: #f8faff;
}

td strong,
td small {
  display: block;
}

td strong {
  color: #374151;
  font-weight: 600;
}

td small {
  margin-top: 5px;
  color: #9ca3af;
  font-size: 11px;
}

.reference {
  display: inline-block;
  max-width: 155px;
  padding: 5px 7px;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.event-title {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
}

.date-cell {
  white-space: nowrap;
  font-size: 12px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: capitalize;
  white-space: nowrap;
}

.details-button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: #6b7280;
}

.details-button:hover {
  color: #2563eb;
  background: #eff6ff;
}

.details-button i {
  font-size: 20px;
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 64px 24px;
  text-align: center;
  color: #9ca3af;
}

.state-block h3 {
  color: #374151;
  font-size: 15px;
  font-weight: 700;
}

.state-block p {
  font-size: 13px;
}

.empty-icon {
  font-size: 36px;
}

.mobile-list {
  display: none;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  color: #6b7280;
  font-size: 12px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 14px;
}

.pagination-controls button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #374151;
  font-weight: 600;
}

.pagination-controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}

.order-drawer {
  display: flex;
  flex-direction: column;
  width: min(680px, 100%);
  height: 100%;
  background: #f9fafb;
  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.12);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.drawer-eyebrow {
  margin-bottom: 7px;
  color: #9ca3af;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.drawer-header h2 {
  max-width: 500px;
  overflow-wrap: anywhere;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

.drawer-close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #f3f4f6;
  color: #374151;
  font-size: 20px;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.detail-hero {
  padding: 22px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
}

.detail-hero h3 {
  margin-top: 14px;
  font-size: 30px;
  font-weight: 800;
  color: #111827;
  overflow-wrap: anywhere;
}

.detail-hero p {
  margin-top: 5px;
  color: #9ca3af;
  font-size: 12px;
}

.detail-section {
  margin-top: 18px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
}

.detail-section > h3 {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 17px;
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
}

.detail-section > h3 i {
  color: #2563eb;
  font-size: 19px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.detail-field > span {
  color: #9ca3af;
  font-size: 10px;
  text-transform: capitalize;
}

.detail-field > strong {
  color: #374151;
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.nested-card {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid #edf0f5;
  border-radius: 11px;
  background: #fcfcfd;
}

.nested-card-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
  color: #374151;
  font-size: 12px;
}

.nested-card-heading > span {
  color: #9ca3af;
  font-size: 10px;
}

.mini-tag {
  padding: 4px 7px;
  border-radius: 20px;
  background: #f3f4f6;
  color: #4b5563 !important;
  text-transform: capitalize;
}

.nested-subsection {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
}

.nested-subsection h4 {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
}

.nested-empty {
  padding: 14px;
  border-radius: 9px;
  background: #f9fafb;
  color: #9ca3af;
  font-size: 12px;
}

.log-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 12px;
}

.log-row strong {
  text-transform: capitalize;
}

.log-row p {
  margin-top: 4px;
  color: #9ca3af;
  font-size: 10px;
}

.log-row code {
  max-width: 45%;
  overflow-wrap: anywhere;
  color: #6b7280;
  font-size: 10px;
}

.metadata-block {
  max-height: 300px;
  overflow: auto;
  padding: 14px;
  border-radius: 10px;
  background: #111827;
  color: #d1fae5;
  font: 11px/1.6 'Courier New', monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.drawer-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.drawer-done {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  background: #2563eb;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active .order-drawer,
.drawer-leave-active .order-drawer {
  transition: transform 0.25s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .order-drawer,
.drawer-leave-to .order-drawer {
  transform: translateX(40px);
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .desktop-table {
    display: none;
  }

  .mobile-list {
    display: block;
    padding: 12px;
  }

  .mobile-order {
    display: block;
    width: 100%;
    padding: 16px;
    border: 1px solid #edf0f5;
    border-radius: 12px;
    background: #fff;
    text-align: left;
  }

  .mobile-order + .mobile-order {
    margin-top: 10px;
  }

  .mobile-order-top,
  .mobile-order-middle,
  .mobile-order-bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .mobile-order-info {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }

  .mobile-order-info strong {
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .mobile-order-info code {
    width: fit-content;
    max-width: 100%;
    padding: 4px 6px;
    border-radius: 5px;
    background: #eff6ff;
    color: #2563eb;
    font-size: 10px;
    overflow-wrap: anywhere;
  }

  .mobile-order-middle {
    margin-top: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f3f4f6;
    color: #6b7280;
    font-size: 12px;
  }

  .mobile-order-middle strong {
    color: #111827;
    font-size: 14px;
    white-space: nowrap;
  }

  .mobile-order-bottom {
    margin-top: 10px;
    color: #9ca3af;
    font-size: 10px;
  }
}

@media (max-width: 640px) {
  .orders-page {
    padding: 16px;
  }

  .page-header h1 {
    font-size: 24px;
  }

  .summary-grid {
    gap: 10px;
  }

  .summary-card {
    padding: 14px;
  }

  .summary-icon {
    width: 34px;
    height: 34px;
    font-size: 18px;
  }

  .filters {
    padding: 14px;
  }

  .filters select {
    flex: 1;
    min-width: 0;
  }

  .panel-heading {
    padding: 18px 16px;
  }

  .pagination {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
  }

  .pagination-controls {
    width: 100%;
    justify-content: space-between;
    gap: 8px;
  }

  .drawer-header {
    padding: 18px 16px;
  }

  .drawer-content {
    padding: 12px;
  }

  .detail-section {
    padding: 15px;
  }

  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 13px;
  }

  .detail-hero h3 {
    font-size: 25px;
  }
}
</style>
