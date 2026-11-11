<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import PartnerDetailDialog from '@/components/admin/PartnerDetailDialog.vue'
import { adminService } from '@/services/adminService'
import { apiError } from '@/services/eventsService'
import { partnerBadge, kycBadge, humanize, fmtDate } from '@/lib/adminHelpers'

const LIMIT = 20
const STATUSES = [
  { label: 'All', value: null },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Suspended', value: 'suspended' },
]
const KYC_OPTIONS = [
  { title: 'All KYC', value: null },
  ...['not_started', 'submitted', 'under_review', 'resubmission_required', 'approved', 'rejected', 'suspended']
    .map((v) => ({ title: humanize(v), value: v })),
]

const rows = ref([])
const total = ref(0)
const page = ref(1)
const q = ref('')
const status = ref(null)
const kyc = ref(null)
const loading = ref(true)
const error = ref('')
const selectedId = ref(null)
const open = ref(false)
let reqId = 0
let timer

async function load() {
  const id = ++reqId
  loading.value = true
  error.value = ''
  try {
    const res = await adminService.partners.list({
      page: page.value, limit: LIMIT,
      q: q.value.trim() || undefined, status: status.value || undefined, kyc_status: kyc.value || undefined,
    })
    if (id !== reqId) return
    rows.value = res.data
    total.value = res.total ?? 0
  } catch (e) {
    if (id === reqId) error.value = apiError(e, 'Could not load partners.')
  } finally {
    if (id === reqId) loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => clearTimeout(timer))
watch([status, kyc], () => { page.value = 1; load() })
watch(q, () => {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; load() }, 350)
})

const from = computed(() => (total.value ? (page.value - 1) * LIMIT + 1 : 0))
const to = computed(() => Math.min(page.value * LIMIT, total.value))
const go = (p) => { page.value = p; load() }
const view = (p) => { selectedId.value = p.id; open.value = true }
const fee = (p) => (p.platform_fee_percent === null ? 'Default' : p.platform_fee_percent + '%')
</script>

<template>
  <MainLayout>
    <div class="dash-container">
      <div class="dash-header">
        <div>
          <h1 class="dash-title">Partners</h1>
          <p class="dash-subtitle">Manage every business on the platform</p>
        </div>
        <v-btn icon="mdi-refresh" variant="text" size="small" :loading="loading" @click="load" />
      </div>

      <div v-if="error" class="error-banner">
        <i class="mdi mdi-alert-circle-outline"></i> {{ error }}
        <button type="button" class="q-link ml-auto" @click="load">Retry</button>
      </div>

      <!-- Filters -->
      <div class="filters">
        <v-text-field v-model="q" placeholder="Search business, contact or email" prepend-inner-icon="mdi-magnify"
          density="compact" variant="outlined" hide-details clearable class="f-search" />
        <div class="period">
          <button v-for="s in STATUSES" :key="s.label" type="button" class="period__btn"
            :class="{ 'period__btn--on': status === s.value }" @click="status = s.value">{{ s.label }}</button>
        </div>
        <v-select v-model="kyc" :items="KYC_OPTIONS" density="compact" variant="outlined" hide-details class="f-kyc" />
      </div>

      <div class="panel">
        <div v-if="!rows.length" class="empty">
          <v-progress-circular v-if="loading" indeterminate color="#2b7fff" size="26" />
          <template v-else>
            <i class="mdi mdi-domain"></i>
            <p>No partners match your filters.</p>
          </template>
        </div>

        <div v-else class="table-wrapper">
          <table class="orders-table">
            <thead>
              <tr><th>Business</th><th>Contact</th><th>Status</th><th>KYC</th><th>Fee</th><th>Joined</th></tr>
            </thead>
            <tbody :class="{ dim: loading }">
              <tr v-for="p in rows" :key="p.id" @click="view(p)">
                <td>
                  <span class="block font-semibold text-sm trunc">{{ p.business_name }}</span>
                  <span class="block q-help">{{ p.country }}</span>
                </td>
                <td>
                  <span class="block text-sm trunc">{{ p.contact_name }}</span>
                  <span class="block q-help trunc">{{ p.email }}</span>
                </td>
                <td><span class="status-badge" :style="partnerBadge(p.status)">{{ p.status }}</span></td>
                <td><span class="status-badge" :style="kycBadge(p.kyc_status)">{{ humanize(p.kyc_status) }}</span></td>
                <td class="amount-cell">{{ fee(p) }}</td>
                <td class="date-cell">{{ fmtDate(p.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="total" class="pager">
          <span class="q-help">Showing {{ from }}–{{ to }} of {{ total }}</span>
          <div>
            <v-btn icon="mdi-chevron-left" variant="text" size="small" :disabled="page <= 1 || loading" @click="go(page - 1)" />
            <v-btn icon="mdi-chevron-right" variant="text" size="small" :disabled="to >= total || loading" @click="go(page + 1)" />
          </div>
        </div>
      </div>
    </div>

    <PartnerDetailDialog v-model="open" :partner-id="selectedId" @changed="load" />
  </MainLayout>
</template>

<style scoped>
.dash-container { width: 100%; padding: 24px; }
.dash-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.dash-title { font-size: 28px; font-weight: 700; color: #1f2937; letter-spacing: -0.02em; margin-bottom: 8px; }
.dash-subtitle { font-size: 14px; color: #6b7280; }
.error-banner { display: flex; align-items: center; gap: 8px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 12px; padding: 12px 16px; font-size: 14px; margin-bottom: 20px; }

.filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.f-search { flex: 1 1 260px; max-width: 380px; }
.f-kyc { flex: 0 0 200px; }
.period { display: inline-flex; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 3px; }
.period__btn { padding: 6px 12px; font-size: 12px; font-weight: 600; color: #6b7280; border-radius: 8px; border: 0; background: none; cursor: pointer; }
.period__btn--on { background: #eaf2ff; color: #2b7fff; }

.panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 44px 24px; color: #9ca3af; font-size: 14px; }
.empty i { font-size: 34px; }
.table-wrapper { overflow-x: auto; }
.orders-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.orders-table thead { background: #f9fafb; }
.orders-table th { padding: 12px 20px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #9ca3af; white-space: nowrap; }
.orders-table tbody tr { border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background-color 0.2s ease; }
.orders-table tbody tr:hover { background: #f8f9ff; }
.orders-table td { padding: 14px 20px; color: #4b5563; }
.dim { opacity: 0.55; transition: opacity 0.15s; }
.trunc { display: block; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.amount-cell { font-weight: 600; color: #1f2937; white-space: nowrap; }
.date-cell { color: #9ca3af; font-size: 13px; white-space: nowrap; }
.status-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid; text-transform: capitalize; white-space: nowrap; }
.pager { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px 8px 20px; border-top: 1px solid #f3f4f6; }

@media (max-width: 640px) {
  .dash-container { padding: 16px; }
  .dash-title { font-size: 24px; }
  .f-search, .f-kyc { flex: 1 1 100%; max-width: none; }
}
</style>