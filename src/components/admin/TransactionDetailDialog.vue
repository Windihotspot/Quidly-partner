<script setup>
import { ref, watch } from 'vue'
import { adminService } from '@/services/adminService'
import { apiError } from '@/services/eventsService'
import { formatNaira } from '@/lib/eventHelpers'
import { txBadge, txLabel, partnerBadge, humanize, fmtDateTime } from '@/lib/adminHelpers'

const props = defineProps({ modelValue: Boolean, txId: { type: String, default: null } })
const emit = defineEmits(['update:modelValue'])

const d = ref(null)
const loading = ref(false)
const error = ref('')
const copied = ref(false)
const showMeta = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    d.value = await adminService.transactions.get(props.txId)
  } catch (e) {
    error.value = apiError(e, 'Could not load transaction.')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.txId],
  ([open, id]) => {
    if (open && id) {
      d.value = null
      showMeta.value = false
      load()
    }
  },
  { immediate: true }
)

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {}
}

const money = (v, cur) => (cur && cur !== 'NGN' ? `${cur} ${Number(v).toLocaleString()}` : formatNaira(v))
const close = () => emit('update:modelValue', false)
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="720" scrollable @update:model-value="close">
    <v-card class="td">
      <div class="td-head">
        <div v-if="d" class="min-w-0">
          <div class="td-ref">
            <code>{{ d.transaction.reference }}</code>
            <button type="button" class="q-link text-sm" @click="copy(d.transaction.reference)">
              <i class="mdi" :class="copied ? 'mdi-check' : 'mdi-content-copy'"></i>
            </button>
          </div>
          <div class="td-badges">
            <span class="badge" :style="txBadge(d.transaction.status)">{{ txLabel(d.transaction.status) }}</span>
            <span class="q-help">{{ fmtDateTime(d.transaction.created_at) }}</span>
          </div>
        </div>
        <v-progress-circular v-else-if="loading" indeterminate color="#2b7fff" size="22" />
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </div>

      <v-card-text class="td-body">
        <div v-if="error" class="error-banner"><i class="mdi mdi-alert-circle-outline"></i> {{ error }}</div>

        <template v-if="d">
          <div v-if="d.transaction.failed_reason" class="note">
            <b>Failure reason:</b> {{ d.transaction.failed_reason }}
          </div>

          <!-- Money -->
          <div class="td-stats">
            <div><span>Amount</span><b>{{ money(d.transaction.amount, d.transaction.currency) }}</b></div>
            <div><span>Platform fee</span><b>{{ d.transaction.platform_fee == null ? '—' : money(d.transaction.platform_fee, d.transaction.currency) }}</b></div>
            <div><span>Refunded</span><b>{{ money(d.transaction.refunded_amount, d.transaction.currency) }}</b></div>
            <div><span>Quantity</span><b>{{ d.transaction.quantity }}</b></div>
          </div>

          <!-- Details -->
          <section class="td-sec">
            <h3>Order</h3>
            <div class="td-grid">
              <div><span>Event</span>{{ d.transaction.events?.event_name || '—' }}</div>
              <div><span>Partner</span>{{ d.transaction.partners?.business_name || '—' }}</div>
              <div><span>Ticket type</span>{{ d.transaction.ticket_types?.name || '—' }}</div>
              <div><span>Payment method</span>{{ humanize(d.transaction.payment_method) }}</div>
              <div><span>Attempted</span>{{ fmtDateTime(d.transaction.attempted_at) }}</div>
              <div><span>Completed</span>{{ fmtDateTime(d.transaction.completed_at) }}</div>
              <div class="wide"><span>Gateway reference</span>{{ d.transaction.payment_gateway_ref || '—' }}</div>
            </div>
          </section>

          <section class="td-sec">
            <h3>Customer</h3>
            <div class="td-grid">
              <div><span>Name</span>{{ d.transaction.customer_name }}</div>
              <div><span>Email</span>{{ d.transaction.customer_email }}</div>
              <div><span>Phone</span>{{ d.transaction.customer_phone || '—' }}</div>
              <div><span>Account</span>{{ d.transaction.customer_user_id ? 'Registered user' : 'Guest' }}</div>
            </div>
          </section>

          <!-- Tickets -->
          <section class="td-sec">
            <h3>Tickets ({{ d.tickets.length }})</h3>
            <p v-if="!d.tickets.length" class="q-help">No tickets issued for this transaction.</p>
            <ul v-else class="td-list">
              <li v-for="t in d.tickets" :key="t.id">
                <code>{{ t.ticket_reference }}</code>
                <span class="td-tags">
                  <span v-if="t.checked_in_at" class="q-help">in {{ fmtDateTime(t.checked_in_at) }}</span>
                  <span class="badge" :style="partnerBadge(t.status === 'active' ? 'active' : t.status === 'used' ? 'pending' : 'suspended')">{{ t.status }}</span>
                </span>
              </li>
            </ul>
          </section>

          <!-- Delivery -->
          <section class="td-sec">
            <h3>Ticket email</h3>
            <p v-if="!d.delivery" class="q-help">No delivery record.</p>
            <template v-else>
              <div class="td-grid">
                <div><span>Status</span><span class="badge" :style="partnerBadge(d.delivery.status === 'sent' ? 'active' : d.delivery.status === 'failed' ? 'failed' : 'pending')">{{ d.delivery.status }}</span></div>
                <div><span>Attempts</span>{{ d.delivery.attempts }} · {{ d.delivery.resend_count }} resend(s)</div>
                <div><span>Sent</span>{{ fmtDateTime(d.delivery.sent_at) }}</div>
                <div><span>Last attempt</span>{{ fmtDateTime(d.delivery.last_attempt_at) }}</div>
              </div>
              <div v-if="d.delivery.last_error" class="note mt-2"><b>Last error:</b> {{ d.delivery.last_error }}</div>
            </template>
          </section>

          <!-- Metadata -->
          <section v-if="d.transaction.metadata" class="td-sec">
            <button type="button" class="q-link text-sm" @click="showMeta = !showMeta">
              {{ showMeta ? 'Hide' : 'Show' }} raw metadata
            </button>
            <pre v-if="showMeta" class="td-pre">{{ JSON.stringify(d.transaction.metadata, null, 2) }}</pre>
          </section>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.td { border-radius: 14px; }
.td-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 20px 24px 12px; border-bottom: 1px solid #f3f4f6; }
.td-ref { display: flex; align-items: center; gap: 10px; }
.td-ref code { font-family: 'Courier New', monospace; font-size: 15px; font-weight: 600; color: #2b7fff; background: #e3f0ff; padding: 4px 10px; border-radius: 8px; word-break: break-all; }
.td-badges { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.td-body { padding: 20px 24px 24px; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; border: 1px solid; text-transform: capitalize; white-space: nowrap; }
.error-banner { display: flex; gap: 8px; align-items: center; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 12px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
.note { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }
.td-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 8px; }
.td-stats > div { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.td-stats span, .td-grid span:not(.badge) { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #9ca3af; margin-bottom: 2px; }
.td-stats b { font-size: 16px; color: #1f2937; }
.td-sec { border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 16px; }
.td-sec h3 { font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px; }
.td-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; font-size: 13px; color: #374151; word-break: break-word; }
.td-grid .wide { grid-column: 1 / -1; }
.td-list { list-style: none; margin: 0; padding: 0; }
.td-list li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
.td-list code { font-size: 12px; color: #2b7fff; background: #e3f0ff; padding: 2px 6px; border-radius: 6px; }
.td-tags { display: flex; align-items: center; gap: 8px; }
.td-pre { margin-top: 8px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; font-size: 12px; overflow: auto; max-height: 220px; }
</style>