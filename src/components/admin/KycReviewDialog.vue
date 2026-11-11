<script setup>
import { ref, computed, watch } from 'vue'
import { adminService } from '@/services/adminService'
import { apiError } from '@/services/eventsService'
import { kycBadge, humanize, docLabel, fmtDate } from '@/lib/adminHelpers'

const props = defineProps({
  modelValue: Boolean,
  partnerId: { type: String, default: null },
  submissionId: { type: String, default: null }
})
const emit = defineEmits(['update:modelValue', 'changed'])

const d = ref(null)
const selId = ref(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const reveal = ref(false)
const pending = ref(null) // decision awaiting confirmation
const reason = ref('')

async function load(keepSel = false) {
  loading.value = true
  error.value = ''
  try {
    d.value = await adminService.kyc.get(props.partnerId)
    if (!keepSel || !d.value.submissions.some((s) => s.id === selId.value)) {
      selId.value = props.submissionId ?? d.value.submissions[0]?.id ?? null
    }
  } catch (e) {
    error.value = apiError(e, 'Could not load KYC details.')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.partnerId],
  ([open, id]) => {
    if (open && id) {
      d.value = null
      reveal.value = false
      pending.value = null
      reason.value = ''
      load()
    }
  },
  { immediate: true }
)

const sub = computed(() => d.value?.submissions.find((s) => s.id === selId.value))
const docs = computed(() =>
  (d.value?.documents ?? []).filter((x) => x.kyc_submission_id === selId.value)
)
const actionable = computed(
  () =>
    sub.value &&
    sub.value.id === d.value.submissions[0].id &&
    ['submitted', 'under_review'].includes(sub.value.status)
)
const unverified = computed(() => docs.value.filter((x) => !x.verified).length)
const title = computed(() => sub.value?.legal_business_name || 'KYC review')

const mask = (v) =>
  !v ? '—' : reveal.value ? v : '•'.repeat(Math.max(0, v.length - 3)) + v.slice(-3)
const addr = computed(
  () =>
    [sub.value?.business_address, sub.value?.business_city, sub.value?.business_state]
      .filter(Boolean)
      .join(', ') || '—'
)

const needsReason = (dec) => ['rejected', 'resubmission_required'].includes(dec)
const DEC_LABEL = {
  approved: 'Approve',
  rejected: 'Reject',
  resubmission_required: 'Request resubmission',
  under_review: 'Mark under review'
}

function choose(dec) {
  error.value = ''
  reason.value = ''
  if (dec === 'under_review') return submit(dec)
  pending.value = dec
}

async function submit(dec = pending.value) {
  if (needsReason(dec) && !reason.value.trim()) {
    error.value = 'A reason is required — the partner will see it.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await adminService.kyc.review(sub.value.id, dec, reason.value.trim() || undefined)
    pending.value = null
    reason.value = ''
    await load(true)
    emit('changed')
  } catch (e) {
    error.value = apiError(e, 'Could not save your decision.')
  } finally {
    busy.value = false
  }
}

async function toggleVerified(doc) {
  const next = !doc.verified
  doc.verified = next // optimistic
  try {
    await adminService.kyc.verifyDocument(doc.id, next)
  } catch (e) {
    doc.verified = !next
    error.value = apiError(e, 'Could not update document.')
  }
}

const close = () => emit('update:modelValue', false)
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="760" scrollable @update:model-value="close">
    <v-card class="kd">
      <div class="kd-head">
        <div class="min-w-0">
          <h2 class="kd-title">{{ title }}</h2>
          <div v-if="sub" class="kd-badges">
            <span class="badge" :style="kycBadge(sub.status)">{{ humanize(sub.status) }}</span>
            <span class="q-help"
              >Submission #{{ sub.submission_number }} · {{ fmtDate(sub.created_at) }}</span
            >
          </div>
        </div>
        <v-progress-circular v-if="loading && !d" indeterminate color="#2b7fff" size="22" />
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </div>

      <v-card-text class="kd-body">
        <div v-if="error" class="error-banner">
          <i class="mdi mdi-alert-circle-outline"></i> {{ error }}
        </div>

        <p v-if="d && !d.submissions.length" class="q-help">This partner has not submitted KYC.</p>

        <template v-if="sub">
          <!-- Submission switcher -->
          <div v-if="d.submissions.length > 1" class="period">
            <button
              v-for="s in d.submissions"
              :key="s.id"
              type="button"
              class="period__btn"
              :class="{ 'period__btn--on': s.id === selId }"
              @click="selId = s.id"
            >
              #{{ s.submission_number }}
            </button>
          </div>

          <div v-if="sub.rejection_reason" class="note">
            <b>Previous decision:</b> {{ sub.rejection_reason }}
          </div>

          <!-- Business -->
          <section class="kd-sec">
            <h3>Business</h3>
            <div class="kd-grid">
              <div><span>Legal name</span>{{ sub.legal_business_name || '—' }}</div>
              <div><span>Trading name</span>{{ sub.trading_name || '—' }}</div>
              <div><span>Entity type</span>{{ humanize(sub.entity_type) || '—' }}</div>
              <div><span>RC number</span>{{ sub.business_registration_number || '—' }}</div>
              <div><span>TIN</span>{{ sub.tax_identification_number || '—' }}</div>
              <div class="wide"><span>Address</span>{{ addr }}</div>
            </div>
          </section>

          <!-- Director -->
          <section class="kd-sec">
            <div class="kd-sec-head">
              <h3>Director</h3>
              <button type="button" class="q-link text-sm" @click="reveal = !reveal">
                <i class="mdi" :class="reveal ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"></i>
                {{ reveal ? 'Hide' : 'Reveal' }} IDs
              </button>
            </div>
            <div class="kd-grid">
              <div><span>Full name</span>{{ sub.director_full_name || '—' }}</div>
              <div><span>Date of birth</span>{{ fmtDate(sub.director_dob) }}</div>
              <div><span>ID type</span>{{ humanize(sub.director_id_type) || '—' }}</div>
              <div><span>ID number</span>{{ mask(sub.director_id_number) }}</div>
              <div><span>NIN</span>{{ mask(sub.director_nin) }}</div>
              <div><span>BVN</span>{{ mask(sub.director_bvn) }}</div>
            </div>
          </section>

          <!-- Documents -->
          <section class="kd-sec">
            <h3>Documents</h3>
            <p v-if="!docs.length" class="q-help">No documents uploaded.</p>
            <ul v-else class="kd-list">
              <li v-for="x in docs" :key="x.id">
                <span class="min-w-0">
                  <b>{{ docLabel(x.document_type) }}</b>
                  <a
                    v-if="x.url"
                    :href="x.url"
                    target="_blank"
                    rel="noopener"
                    class="q-link text-sm trunc"
                    >{{ x.file_name }}</a
                  >
                  <span v-else class="q-help">{{ x.file_name }} (link unavailable)</span>
                </span>
                <v-checkbox-btn
                  :model-value="x.verified"
                  density="compact"
                  color="#059669"
                  @click.prevent="toggleVerified(x)"
                />
              </li>
            </ul>
            <p v-if="docs.length" class="q-help mt-1">
              Tick a document once you've checked it. Links expire after 10 minutes.
            </p>
          </section>

          <!-- Decision -->
          <section v-if="actionable" class="kd-sec">
            <h3>Decision</h3>
            <div v-if="!pending" class="kd-row">
              <v-btn
                v-if="sub.status === 'submitted'"
                variant="outlined"
                size="small"
                :loading="busy"
                @click="choose('under_review')"
              >
                Mark under review
              </v-btn>
              <v-btn class="q-btn-primary" size="small" @click="choose('approved')">Approve</v-btn>
              <v-btn
                color="warning"
                variant="outlined"
                size="small"
                @click="choose('resubmission_required')"
                >Request resubmission</v-btn
              >
              <v-btn color="error" variant="outlined" size="small" @click="choose('rejected')"
                >Reject</v-btn
              >
            </div>
            <div v-else>
              <p v-if="pending === 'approved'" class="note">
                <template v-if="unverified"
                  >{{ unverified }} document(s) are not ticked as verified.
                </template>
                Approving will mark the partner's KYC as approved and activate a pending account.
              </p>
              <v-textarea
                v-if="needsReason(pending)"
                v-model="reason"
                rows="3"
                auto-grow
                variant="outlined"
                density="compact"
                hide-details
                placeholder="Explain what's wrong or what to fix. The partner will see this."
              />
              <div class="kd-row mt-2">
                <v-btn
                  :color="
                    pending === 'approved'
                      ? undefined
                      : pending === 'rejected'
                        ? 'error'
                        : 'warning'
                  "
                  :class="{ 'q-btn-primary': pending === 'approved' }"
                  size="small"
                  :loading="busy"
                  @click="submit()"
                >
                  Confirm: {{ DEC_LABEL[pending] }}
                </v-btn>
                <button
                  type="button"
                  class="q-link text-sm"
                  :disabled="busy"
                  @click="pending = null"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>

          <!-- History -->
          <section v-if="d.history.length" class="kd-sec">
            <h3>History</h3>
            <ul class="kd-list">
              <li v-for="h in d.history" :key="h.id">
                <span>
                  <span class="badge" :style="kycBadge(h.to_status)">{{
                    humanize(h.to_status)
                  }}</span>
                  <span v-if="h.reason" class="q-help"> — {{ h.reason }}</span>
                </span>
                <span class="q-help">{{ fmtDate(h.created_at) }}</span>
              </li>
            </ul>
          </section>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.kd {
  border-radius: 14px;
}
.kd-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 24px 12px;
  border-bottom: 1px solid #f3f4f6;
}
.kd-title {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}
.kd-badges {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.kd-body {
  padding: 20px 24px 24px;
}
.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid;
  text-transform: capitalize;
  white-space: nowrap;
}
.error-banner {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 13px;
  margin-bottom: 16px;
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
.period {
  display: inline-flex;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 12px;
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
.kd-sec {
  border-top: 1px solid #f3f4f6;
  padding-top: 16px;
  margin-top: 16px;
}
.kd-sec:first-of-type {
  border-top: 0;
  margin-top: 0;
  padding-top: 0;
}
.kd-sec h3 {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}
.kd-sec-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.kd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
  font-size: 13px;
  color: #374151;
}
.kd-grid .wide {
  grid-column: 1 / -1;
}
.kd-grid span {
  display: block;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9ca3af;
  margin-bottom: 2px;
}
.kd-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.kd-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.kd-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
}
.kd-list b {
  display: block;
  color: #1f2937;
}
.trunc {
  display: block;
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
