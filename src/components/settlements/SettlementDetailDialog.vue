<script setup>
import { ref, watch, computed } from 'vue'
import '@/assets/quidly-events.css'
import { settlementsService } from '@/services/settlementsService'
import { apiError } from '@/services/eventsService'
import { formatNaira } from '@/lib/eventHelpers'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  settlementId: { type: String, default: null },
})
const emit = defineEmits(['update:modelValue'])

const data = ref(null)
const loading = ref(false)
const downloading = ref(false)
const error = ref('')

watch(
  () => [props.modelValue, props.settlementId],
  async ([open, id]) => {
    if (!open || !id) return
    data.value = null
    error.value = ''
    loading.value = true
    try {
      data.value = await settlementsService.detail(id)
    } catch (e) {
      error.value = apiError(e, 'Could not load this settlement.')
    } finally {
      loading.value = false
    }
  },
)

const s = computed(() => data.value?.settlement)
const label = computed(() => ({ paid: 'paid', failed: 'failed' }[s.value?.status] ?? 'processing'))
const date = (iso) => (iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

async function download() {
  downloading.value = true
  try { await settlementsService.downloadReport(props.settlementId) } catch (e) { error.value = apiError(e) } finally { downloading.value = false }
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="720" scrollable @update:model-value="(v) => emit('update:modelValue', v)">
    <v-card class="!rounded-xl">
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        <div>
          <p class="text-lg font-semibold">Settlement</p>
          <p v-if="s" class="q-help font-mono">{{ s.reference }}</p>
        </div>
        <v-btn icon="mdi-close" size="small" variant="text" @click="emit('update:modelValue', false)" />
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-5">
        <div v-if="loading" class="py-12 text-center"><v-progress-circular indeterminate color="#2b7fff" /></div>
        <p v-else-if="error" class="q-error">{{ error }}</p>

        <template v-else-if="s">
          <div class="tiles">
            <div><p class="k">Gross</p><p class="v">{{ formatNaira(s.gross) }}</p></div>
            <div><p class="k">Platform fees</p><p class="v">− {{ formatNaira(s.fees) }}</p></div>
            <div><p class="k">Refunds</p><p class="v">− {{ formatNaira(s.refunds) }}</p></div>
            <div class="tile--net"><p class="k">Net payout</p><p class="v">{{ formatNaira(s.net) }}</p></div>
          </div>

          <div class="meta">
            <div><span>Status</span><b class="pill" :class="`pill--${label}`">{{ label }}</b></div>
            <div><span>Sales covered</span><b>{{ date(s.period_start) }} to {{ date(s.period_end) }}</b></div>
            <div><span>Paid to</span><b>{{ s.account_name }} · {{ s.bank_name }} · {{ s.account_number }}</b></div>
            <div v-if="s.paid_at"><span>Paid on</span><b>{{ date(s.paid_at) }}</b></div>
            <div v-if="s.payout_reference"><span>Bank reference</span><b class="font-mono">{{ s.payout_reference }}</b></div>
          </div>
          <p v-if="s.status === 'failed'" class="failed">
            We couldn't complete this payout. Contact support@quidly.com and quote {{ s.reference }}.
          </p>

          <h3 class="font-bold mt-6 mb-2">By event</h3>
          <div class="tbl">
            <div class="tbl__row tbl__head"><span>Event</span><span>Tickets</span><span>Gross</span><span>Fees</span></div>
            <div v-for="e in data.by_event" :key="e.event_name" class="tbl__row">
              <span class="trunc">{{ e.event_name }}</span><span>{{ e.tickets }}</span><span>{{ formatNaira(e.gross) }}</span><span>{{ formatNaira(e.fees) }}</span>
            </div>
          </div>
          <p class="q-help mt-2">{{ data.sales_total }} sale{{ data.sales_total === 1 ? '' : 's' }} in this settlement. Download the report for every line.</p>
        </template>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn class="q-btn-ghost" @click="emit('update:modelValue', false)">Close</v-btn>
        <v-btn class="q-btn-primary" prepend-icon="mdi-download-outline" :disabled="!s" :loading="downloading" @click="download">Download report</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.tiles > div { background: #f8f9fa; border-radius: 12px; padding: 12px 14px; }
.tile--net { background: #2b7fff !important; color: #fff; }
.k { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; }
.v { font-weight: 700; margin-top: 2px; font-size: 15px; }
.meta { margin-top: 18px; display: grid; gap: 8px; font-size: 14px; }
.meta > div { display: flex; justify-content: space-between; gap: 16px; }
.meta span { color: #6b7280; }
.meta b { font-weight: 600; text-align: right; }
.pill { font-size: 11px; padding: 2px 10px; border-radius: 99px; text-transform: capitalize; }
.pill--paid { background: #e8f5e9; color: #1b8a3a; }
.pill--processing { background: #fff3e0; color: #b45309; }
.pill--failed { background: #fee2e2; color: #b91c1c; }
.failed { margin-top: 12px; background: #fef2f2; color: #b91c1c; border-radius: 10px; padding: 10px 14px; font-size: 13px; }
.tbl { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; font-size: 14px; }
.tbl__row { display: grid; grid-template-columns: 2fr .8fr 1.2fr 1.2fr; padding: 10px 14px; border-top: 1px solid #f0f1f3; gap: 8px; }
.tbl__row:first-child { border-top: 0; }
.tbl__head { background: #f9fafb; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; }
.trunc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 640px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
</style>
