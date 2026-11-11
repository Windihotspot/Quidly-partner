<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import KycReviewDialog from '@/components/admin/KycReviewDialog.vue'
import { adminService } from '@/services/adminService'
import { apiError } from '@/services/eventsService'
import { kycBadge, humanize, fmtDate } from '@/lib/adminHelpers'

const route = useRoute()
const router = useRouter()
const LIMIT = 20
const TABS = [
  { label: 'Pending', value: ['submitted', 'under_review'] },
  { label: 'Approved', value: ['approved'] },
  { label: 'Rejected', value: ['rejected'] },
  { label: 'All', value: ['submitted', 'under_review', 'approved', 'rejected'] }
]

const tab = ref(0)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const error = ref('')
const open = ref(false)
const partnerId = ref(null)
const submissionId = ref(null)
let reqId = 0

async function load() {
  const id = ++reqId
  loading.value = true
  error.value = ''
  try {
    const res = await adminService.kyc.queue({
      page: page.value,
      limit: LIMIT,
      statuses: TABS[tab.value].value
    })
    if (id !== reqId) return
    rows.value = res.data
    total.value = res.total ?? 0
  } catch (e) {
    if (id === reqId) error.value = apiError(e, 'Could not load KYC submissions.')
  } finally {
    if (id === reqId) loading.value = false
  }
}

onMounted(() => {
  load()
  if (route.query.partner) openReview({ partner_id: route.query.partner })
})
watch(tab, () => {
  page.value = 1
  load()
})
watch(open, (v) => {
  if (!v && route.query.partner) router.replace({ query: {} })
})

function openReview(r) {
  partnerId.value = r.partner_id
  submissionId.value = r.id ?? null
  open.value = true
}

const from = computed(() => (total.value ? (page.value - 1) * LIMIT + 1 : 0))
const to = computed(() => Math.min(page.value * LIMIT, total.value))
const go = (p) => {
  page.value = p
  load()
}
</script>

<template>
  <MainLayout>
    <div class="dash-container">
      <div class="dash-header">
        <div>
          <h1 class="dash-title">KYC Reviews</h1>
          <p class="dash-subtitle">Verify businesses before they can receive payouts</p>
        </div>
        <v-btn icon="mdi-refresh" variant="text" size="small" :loading="loading" @click="load" />
      </div>

      <div v-if="error" class="error-banner">
        <i class="mdi mdi-alert-circle-outline"></i> {{ error }}
        <button type="button" class="q-link ml-auto" @click="load">Retry</button>
      </div>

      <div class="period mb-4">
        <button
          v-for="(t, i) in TABS"
          :key="t.label"
          type="button"
          class="period__btn"
          :class="{ 'period__btn--on': tab === i }"
          @click="tab = i"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="panel">
        <div v-if="!rows.length" class="empty">
          <v-progress-circular v-if="loading" indeterminate color="#2b7fff" size="26" />
          <template v-else>
            <i class="mdi mdi-shield-check-outline"></i>
            <p>{{ tab === 0 ? 'Nothing waiting for review.' : 'No submissions here.' }}</p>
          </template>
        </div>

        <div v-else class="table-wrapper">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Entity</th>
                <th>Submission</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody :class="{ dim: loading }">
              <tr v-for="r in rows" :key="r.id" @click="openReview(r)">
                <td>
                  <span class="block font-semibold text-sm trunc">{{
                    r.legal_business_name || r.partners?.business_name
                  }}</span>
                  <span class="block q-help trunc">{{ r.partners?.email }}</span>
                </td>
                <td class="text-sm">{{ humanize(r.entity_type) || '—' }}</td>
                <td class="text-sm">#{{ r.submission_number }}</td>
                <td>
                  <span class="status-badge" :style="kycBadge(r.status)">{{
                    humanize(r.status)
                  }}</span>
                </td>
                <td class="date-cell">{{ fmtDate(r.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="total" class="pager">
          <span class="q-help">Showing {{ from }}–{{ to }} of {{ total }}</span>
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

    <KycReviewDialog
      v-model="open"
      :partner-id="partnerId"
      :submission-id="submissionId"
      @changed="load"
    />
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
.period {
  display: inline-flex;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 3px;
}
.period__btn {
  padding: 6px 14px;
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
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.orders-table tbody tr:hover {
  background: #f8f9ff;
}
.orders-table td {
  padding: 14px 20px;
  color: #4b5563;
}
.dim {
  opacity: 0.55;
  transition: opacity 0.15s;
}
.trunc {
  display: block;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}
</style>
