<script setup>
import { ref, watch } from 'vue'
import { adminService } from '@/services/adminService'
import { apiError } from '@/services/eventsService'
import { formatNaira } from '@/lib/eventHelpers'
import { partnerBadge, kycBadge, humanize, fmtDate } from '@/lib/adminHelpers'

const props = defineProps({ modelValue: Boolean, partnerId: { type: String, default: null } })
const emit = defineEmits(['update:modelValue', 'changed'])

const d = ref(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const fee = ref('')
const reason = ref('')
const suspending = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    d.value = await adminService.partners.get(props.partnerId)
    fee.value = d.value.partner.platform_fee_percent ?? ''
  } catch (e) {
    error.value = apiError(e, 'Could not load partner.')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.partnerId],
  ([open, id]) => {
    if (open && id) {
      d.value = null
      suspending.value = false
      reason.value = ''
      load()
    }
  },
  { immediate: true }
)

async function run(fn, fallback) {
  busy.value = true
  error.value = ''
  try {
    await fn()
    await load()
    emit('changed')
    return true
  } catch (e) {
    error.value = apiError(e, fallback)
    return false
  } finally {
    busy.value = false
  }
}

async function setStatus(status) {
  const ok = await run(
    () => adminService.partners.setStatus(props.partnerId, status, reason.value.trim() || undefined),
    'Could not update status.'
  )
  if (ok) { suspending.value = false; reason.value = '' }
}

function saveFee(useDefault = false) {
  const v = useDefault ? null : Number(fee.value)
  if (!useDefault && (fee.value === '' || Number.isNaN(v) || v < 0 || v > 100)) {
    error.value = 'Enter a fee between 0 and 100.'
    return
  }
  return run(() => adminService.partners.setFee(props.partnerId, v), 'Could not update fee.')
}

const close = () => emit('update:modelValue', false)
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="680" scrollable @update:model-value="close">
    <v-card class="pd">
      <div class="pd-head">
        <div v-if="d" class="min-w-0">
          <h2 class="pd-title">{{ d.partner.business_name }}</h2>
          <p class="q-help">{{ d.partner.contact_name }} · {{ d.partner.email }}</p>
          <div class="pd-badges">
            <span class="badge" :style="partnerBadge(d.partner.status)">{{ d.partner.status }}</span>
            <span class="badge" :style="kycBadge(d.partner.kyc_status)">KYC: {{ humanize(d.partner.kyc_status) }}</span>
          </div>
        </div>
        <v-progress-circular v-else-if="loading" indeterminate color="#2b7fff" size="22" />
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </div>

      <v-card-text class="pd-body">
        <div v-if="error" class="error-banner"><i class="mdi mdi-alert-circle-outline"></i> {{ error }}</div>

        <template v-if="d">
          <!-- Stats -->
          <div class="pd-stats">
            <div><span>Events</span><b>{{ d.event_count }}</b></div>
            <div><span>Sales</span><b>{{ d.sales.count }}</b></div>
            <div><span>Gross</span><b>{{ formatNaira(d.sales.gross) }}</b></div>
            <div><span>Fees earned</span><b>{{ formatNaira(d.sales.fees) }}</b></div>
          </div>

          <!-- Profile -->
          <div class="pd-grid">
            <div><span>Phone</span>{{ d.partner.phone || '—' }}</div>
            <div><span>Country</span>{{ d.partner.country }}</div>
            <div><span>Business type</span>{{ d.partner.business_type || '—' }}</div>
            <div><span>Website</span>{{ d.partner.website || '—' }}</div>
            <div><span>RC number</span>{{ d.partner.business_registration_number || '—' }}</div>
            <div><span>Joined</span>{{ fmtDate(d.partner.created_at) }}</div>
          </div>

          <!-- Fee -->
          <section class="pd-sec">
            <h3>Platform fee</h3>
            <p class="q-help">
              Current: {{ d.partner.platform_fee_percent === null ? 'Platform default' : d.partner.platform_fee_percent + '%' }}
            </p>
            <div class="pd-row">
              <v-text-field v-model="fee" type="number" min="0" max="100" step="0.1" suffix="%" density="compact"
                variant="outlined" hide-details placeholder="Default" style="max-width: 160px" />
              <v-btn class="q-btn-primary" size="small" :loading="busy" @click="saveFee()">Save</v-btn>
              <button type="button" class="q-link text-sm" :disabled="busy" @click="saveFee(true)">Use default</button>
            </div>
          </section>

          <!-- Status -->
          <section class="pd-sec">
            <h3>Account status</h3>
            <div v-if="!suspending" class="pd-row">
              <v-btn v-if="d.partner.status !== 'active'" class="q-btn-primary" size="small" :loading="busy"
                @click="setStatus('active')">Activate</v-btn>
              <v-btn v-if="d.partner.status !== 'suspended'" color="error" variant="outlined" size="small"
                @click="suspending = true">Suspend</v-btn>
            </div>
            <div v-else>
              <v-textarea v-model="reason" rows="2" auto-grow density="compact" variant="outlined" hide-details
                placeholder="Reason for suspension (recorded in the audit log)" />
              <div class="pd-row mt-2">
                <v-btn color="error" size="small" :loading="busy" @click="setStatus('suspended')">Confirm suspend</v-btn>
                <button type="button" class="q-link text-sm" @click="suspending = false">Cancel</button>
              </div>
            </div>
          </section>

          <!-- Bank accounts -->
          <section class="pd-sec">
            <h3>Payout accounts</h3>
            <p v-if="!d.bank_accounts.length" class="q-help">None added.</p>
            <ul v-else class="pd-list">
              <li v-for="b in d.bank_accounts" :key="b.id">
                <span class="min-w-0">
                  <b class="trunc">{{ b.account_name }}</b>
                  <span class="q-help">{{ b.bank_name }} · {{ b.account_number }}</span>
                </span>
                <span class="pd-tags">
                  <span v-if="b.is_verified" class="badge" :style="partnerBadge('active')">verified</span>
                  <span v-if="!b.is_active" class="badge" :style="partnerBadge('x')">inactive</span>
                </span>
              </li>
            </ul>
          </section>

          <!-- Settlements -->
          <section class="pd-sec">
            <h3>Recent settlements</h3>
            <p v-if="!d.recent_settlements.length" class="q-help">No settlements yet.</p>
            <ul v-else class="pd-list">
              <li v-for="s in d.recent_settlements" :key="s.id">
                <span><code>{{ s.reference }}</code> <span class="q-help">to {{ fmtDate(s.period_end) }}</span></span>
                <span class="pd-tags">
                  <b>{{ formatNaira(s.net) }}</b>
                  <span class="badge" :style="partnerBadge(s.status)">{{ s.status }}</span>
                </span>
              </li>
            </ul>
          </section>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pd { border-radius: 14px; }
.pd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 20px 24px 12px; border-bottom: 1px solid #f3f4f6; }
.pd-title { font-size: 20px; font-weight: 700; color: #1f2937; }
.pd-badges { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.pd-body { padding: 20px 24px 24px; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; border: 1px solid; text-transform: capitalize; white-space: nowrap; }
.error-banner { display: flex; gap: 8px; align-items: center; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 12px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
.pd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 16px; }
.pd-stats > div { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.pd-stats span, .pd-grid span { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #9ca3af; margin-bottom: 2px; }
.pd-stats b { font-size: 16px; color: #1f2937; }
.pd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 13px; color: #374151; margin-bottom: 8px; }
.pd-sec { border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 16px; }
.pd-sec h3 { font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 6px; }
.pd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.pd-list { list-style: none; margin: 0; padding: 0; }
.pd-list li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
.pd-list b { display: block; color: #1f2937; }
.pd-list code { font-size: 12px; color: #2b7fff; background: #e3f0ff; padding: 2px 6px; border-radius: 6px; }
.pd-tags { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.trunc { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>