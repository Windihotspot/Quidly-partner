<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import { adminService } from '@/services/adminService'
import { apiError } from '@/services/eventsService'
import { formatNaira } from '@/lib/eventHelpers'
import { eventBadge, fmtDateTime } from '@/lib/adminHelpers'

const route = useRoute()
const router = useRouter()
const LIMIT = 20
const STATUSES = [
  { label: 'All', value: null },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' }
]
const ACTIONS = {
  published: [
    {
      to: 'draft',
      label: 'Unpublish',
      icon: 'mdi-eye-off-outline',
      reason: true,
      warn: 'Takes the event off the public page.'
    },
    {
      to: 'cancelled',
      label: 'Cancel event',
      icon: 'mdi-cancel',
      reason: true,
      danger: true,
      warn: 'Marks the event as cancelled. Existing buyers are not refunded or notified automatically.'
    },
    { to: 'completed', label: 'Mark completed', icon: 'mdi-check-all' }
  ],
  draft: [
    {
      to: 'published',
      label: 'Publish',
      icon: 'mdi-rocket-launch-outline',
      warn: 'Makes the event public immediately.'
    }
  ],
  cancelled: [{ to: 'draft', label: 'Reinstate as draft', icon: 'mdi-restore' }],
  completed: []
}

const rows = ref([])
const total = ref(0)
const page = ref(1)
const q = ref('')
const status = ref(null)
const partnerId = ref(route.query.partner || null)
const loading = ref(true)
const error = ref('')
const toast = ref('')
let reqId = 0
let timer

async function load() {
  const id = ++reqId
  loading.value = true
  error.value = ''
  try {
    const res = await adminService.events.list({
      page: page.value,
      limit: LIMIT,
      q: q.value.trim() || undefined,
      status: status.value || undefined,
      partner_id: partnerId.value || undefined
    })
    if (id !== reqId) return
    rows.value = res.data
    total.value = res.total ?? 0
  } catch (e) {
    if (id === reqId) error.value = apiError(e, 'Could not load events.')
  } finally {
    if (id === reqId) loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => clearTimeout(timer))
watch([status, partnerId], () => {
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
function clearPartner() {
  partnerId.value = null
  router.replace({ query: {} })
}

// ---- status change ----------------------------------------------------------
const target = ref(null) // { event, action }
const reason = ref('')
const busy = ref(false)
const dlgError = ref('')
const dlgOpen = computed({ get: () => !!target.value, set: (v) => !v && (target.value = null) })

function ask(event, action) {
  target.value = { event, action }
  reason.value = ''
  dlgError.value = ''
}

async function confirm() {
  const { event, action } = target.value
  if (action.reason && !reason.value.trim()) {
    dlgError.value = 'A reason is required. It is recorded in the audit log.'
    return
  }
  busy.value = true
  dlgError.value = ''
  try {
    await adminService.events.setStatus(event.id, action.to, reason.value.trim() || undefined)
    toast.value = `"${event.event_name}" is now ${action.to}.`
    target.value = null
    await load()
  } catch (e) {
    dlgError.value = apiError(e, 'Could not update the event.')
  } finally {
    busy.value = false
  }
}

const from = computed(() => (total.value ? (page.value - 1) * LIMIT + 1 : 0))
const to = computed(() => Math.min(page.value * LIMIT, total.value))
const go = (p) => {
  page.value = p
  load()
}
const price = (e) =>
  e.ticket_price == null ? '—' : Number(e.ticket_price) === 0 ? 'Free' : formatNaira(e.ticket_price)
</script>

<template>
  <MainLayout>
    <div class="dash-container">
      <div class="dash-header">
        <div>
          <h1 class="dash-title">Events</h1>
          <p class="dash-subtitle">Review and moderate events across all partners</p>
        </div>
        <v-btn icon="mdi-refresh" variant="text" size="small" :loading="loading" @click="load" />
      </div>

      <div v-if="error" class="error-banner">
        <i class="mdi mdi-alert-circle-outline"></i> {{ error }}
        <button type="button" class="q-link ml-auto" @click="load">Retry</button>
      </div>

      <div class="filters">
        <v-text-field
          v-model="q"
          placeholder="Search event name"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="f-search"
        />
        <div class="period">
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
        <v-chip
          v-if="partnerId"
          closable
          size="small"
          color="primary"
          variant="tonal"
          @click:close="clearPartner"
        >
          Filtered by partner
        </v-chip>
      </div>

      <div class="panel">
        <div v-if="!rows.length" class="empty">
          <v-progress-circular v-if="loading" indeterminate color="#2b7fff" size="26" />
          <template v-else>
            <i class="mdi mdi-calendar-outline"></i>
            <p>No events match your filters.</p>
          </template>
        </div>

        <div v-else class="table-wrapper">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Partner</th>
                <th>Starts</th>
                <th>Price</th>
                <th>Capacity</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody :class="{ dim: loading }">
              <tr v-for="e in rows" :key="e.id">
                <td>
                  <span class="block font-semibold text-sm trunc">{{ e.event_name }}</span>
                  <span class="block q-help trunc">{{ e.slug || 'no slug' }}</span>
                </td>
                <td class="text-sm">
                  <span class="trunc">{{ e.partners?.business_name }}</span>
                </td>
                <td class="date-cell">{{ fmtDateTime(e.starts_at) }}</td>
                <td class="amount-cell">{{ price(e) }}</td>
                <td class="text-sm">{{ e.total_capacity || '—' }}</td>
                <td>
                  <span class="status-badge" :style="eventBadge(e.status)">{{ e.status }}</span>
                </td>
                <td class="act-cell">
                  <v-menu v-if="ACTIONS[e.status]?.length">
                    <template #activator="{ props }">
                      <v-btn v-bind="props" icon="mdi-dots-vertical" variant="text" size="small" />
                    </template>
                    <v-list density="compact">
                      <v-list-item
                        v-for="a in ACTIONS[e.status]"
                        :key="a.to"
                        :prepend-icon="a.icon"
                        :title="a.label"
                        :base-color="a.danger ? 'error' : undefined"
                        @click="ask(e, a)"
                      />
                    </v-list>
                  </v-menu>
                </td>
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

    <!-- Confirm dialog -->
    <v-dialog v-model="dlgOpen" max-width="460" :persistent="busy">
      <v-card v-if="target" class="cd">
        <h2 class="cd-title">{{ target.action.label }}</h2>
        <p class="cd-sub">
          {{ target.event.event_name }} · {{ target.event.partners?.business_name }}
        </p>
        <p v-if="target.action.warn" class="note">{{ target.action.warn }}</p>
        <v-textarea
          v-if="target.action.reason"
          v-model="reason"
          rows="3"
          auto-grow
          variant="outlined"
          density="compact"
          hide-details
          placeholder="Reason (recorded in the audit log)"
        />
        <div v-if="dlgError" class="error-banner mt-3">
          <i class="mdi mdi-alert-circle-outline"></i> {{ dlgError }}
        </div>
        <div class="cd-actions">
          <button type="button" class="q-link text-sm" :disabled="busy" @click="target = null">
            Cancel
          </button>
          <v-btn
            :color="target.action.danger ? 'error' : undefined"
            :class="{ 'q-btn-primary': !target.action.danger }"
            size="small"
            :loading="busy"
            @click="confirm"
            >Confirm</v-btn
          >
        </div>
      </v-card>
    </v-dialog>

    <v-snackbar :model-value="!!toast" :timeout="3500" @update:model-value="toast = ''">{{
      toast
    }}</v-snackbar>
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
  margin-bottom: 16px;
}
.f-search {
  flex: 1 1 260px;
  max-width: 380px;
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
  transition: background-color 0.2s ease;
}
.orders-table tbody tr:hover {
  background: #f8f9ff;
}
.orders-table td {
  padding: 12px 18px;
  color: #4b5563;
}
.dim {
  opacity: 0.55;
  transition: opacity 0.15s;
}
.trunc {
  display: block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.amount-cell {
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
}
.date-cell {
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}
.act-cell {
  width: 48px;
  text-align: right;
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
}
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 8px 20px;
  border-top: 1px solid #f3f4f6;
}

.cd {
  border-radius: 14px;
  padding: 24px;
}
.cd-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}
.cd-sub {
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0 14px;
}
.note {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  color: #92400e;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  margin-bottom: 12px;
}
.cd-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
}
@media (max-width: 640px) {
  .dash-container {
    padding: 16px;
  }
  .dash-title {
    font-size: 24px;
  }
  .f-search {
    flex: 1 1 100%;
    max-width: none;
  }
}
</style>
