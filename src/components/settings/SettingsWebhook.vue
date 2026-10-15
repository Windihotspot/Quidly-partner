<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import ConfirmDialog from '@/components/settings/ConfirmDialog.vue'
import { partnerSettingsService as api, fieldOf } from '@/services/partnerSettingsService'
import { apiError } from '@/services/eventsService'

const props = defineProps({ state: { type: Object, required: true } })
const emit = defineEmits(['saved', 'notify'])

const form = reactive({ url: '', events: [] })
const busy = reactive({ save: false, rotate: false, test: false, log: false })
const error = ref('')
const errField = ref(null)
const secret = ref('')
const testResult = ref(null)
const rotateOpen = ref(false)

const log = ref({ items: [], total: 0, page: 0, size: 15 })
const logFilter = ref('')
const openId = ref('')
const retrying = ref('')

watch(() => props.state.webhook, (w) => {
  form.url = w.url ?? ''
  form.events = [...w.events]
}, { immediate: true })

const hasUrl = computed(() => !!props.state.webhook.url)
const pages = computed(() => Math.max(1, Math.ceil(log.value.total / log.value.size)))
const fmt = (d) => (d ? new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '')
const eventLabel = (type) => {
  const labels = {
    'ticket.purchased': 'Ticket Purchased',
    ping: 'Test Event',
  }

  return labels[type] ?? type
}

const eventPillClass = (type) => {
  const classes = {
    'ticket.purchased': 'pill pill--ok',
    ping: 'pill pill--info',
  }

  return classes[type] ?? 'pill'
}

async function loadLog(page = 0) {
  busy.log = true
  try {
    log.value = await api.webhookEvents(page, logFilter.value)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.log = false
  }
}
onMounted(() => loadLog(0))

async function save() {
  busy.save = true
  error.value = ''
  errField.value = null
  try {
    const { new_secret, ...state } = await api.updateWebhook(form.url, form.events)
    if (new_secret) secret.value = new_secret
    emit('saved', state)
    emit('notify', form.url ? 'Webhook saved' : 'Webhook removed')
  } catch (e) {
    error.value = apiError(e)
    errField.value = fieldOf(e)
  } finally {
    busy.save = false
  }
}

async function rotate() {
  busy.rotate = true
  try {
    const { new_secret, ...state } = await api.rotateSecret()
    secret.value = new_secret
    emit('saved', state)
    rotateOpen.value = false
  } catch (e) {
    rotateOpen.value = false
    error.value = apiError(e)
  } finally {
    busy.rotate = false
  }
}

async function sendTest() {
  busy.test = true
  testResult.value = null
  error.value = ''
  try {
    testResult.value = await api.testWebhook()
    await loadLog(0)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.test = false
  }
}

async function retry(ev) {
  retrying.value = ev.id
  try {
    const r = await api.retryEvent(ev.id)
    emit('notify', r.ok ? 'Event delivered' : (r.error ?? `Your server responded ${r.status}`))
    await loadLog(log.value.page)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    retrying.value = ''
  }
}

const copySecret = async () => {
  await navigator.clipboard.writeText(secret.value)
  emit('notify', 'Copied')
}
const toggleOpen = (id) => { openId.value = openId.value === id ? '' : id }
const prevPage = () => loadLog(log.value.page - 1)
const nextPage = () => loadLog(log.value.page + 1)
const onFilter = () => loadLog(0)
</script>

<template>
  <div>
    <h2 class="q-section-title">Webhooks</h2>
    <p class="q-help mb-5">We send a signed POST request to your server when these events happen.</p>

    <v-text-field v-model="form.url" label="Endpoint URL" variant="outlined" density="comfortable" color="#2b7fff" placeholder="https://example.com/webhooks/quidly" hint="Clear the field and save to turn webhooks off." persistent-hint :error-messages="errField === 'url' ? error : ''" />

    <p class="font-semibold mt-4 mb-1">Events</p>
    <div class="grid sm:grid-cols-2">
      <v-checkbox v-for="e in state.catalog.webhook_events" :key="e.value" v-model="form.events" :value="e.value" :label="e.label" color="#2b7fff" density="compact" hide-details />
    </div>
    <p v-if="errField === 'events'" class="q-error mt-1">{{ error }}</p>

    <div v-if="secret" class="reveal">
      <p class="font-semibold">Copy your signing secret now. We will not show it again.</p>
      <div class="flex items-center gap-2 mt-2">
        <code class="code flex-1">{{ secret }}</code>
        <v-btn class="q-btn-ghost" @click="copySecret">Copy</v-btn>
      </div>
    </div>

    <p v-if="error && !errField" class="q-error mt-2">{{ error }}</p>
    <div class="flex flex-wrap justify-end gap-2 mt-5">
      <v-btn class="q-btn-ghost" :loading="busy.test" :disabled="!hasUrl" @click="sendTest">Send test event</v-btn>
      <v-btn class="q-btn-primary" min-width="160" :loading="busy.save" @click="save">Save webhook</v-btn>
    </div>
    <p v-if="testResult" class="result" :class="testResult.ok ? 'result--ok' : 'result--bad'">
      {{ testResult.ok ? `Your server responded ${testResult.status} in ${testResult.ms} ms.` : (testResult.error ?? `Your server responded ${testResult.status}. Return a 2xx status to confirm receipt.`) }}
    </p>

    <div class="sep"></div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="q-section-title">Signing secret</h3>
        <p class="q-help">
          {{ state.webhook.secret_last4 ? `whsec_••••••••${state.webhook.secret_last4}` : 'Created when you save your first webhook URL.' }}
          <template v-if="state.webhook.secret_rotated_at"> · Rotated {{ fmt(state.webhook.secret_rotated_at) }}</template>
        </p>
      </div>
      <v-btn class="q-btn-ghost" :disabled="!hasUrl" @click="rotateOpen = true">Rotate secret</v-btn>
    </div>
    <p class="q-help mt-2">Verify each request with the <code>X-Quidly-Signature</code> header: an HMAC-SHA256 of <code>timestamp.body</code> using this secret.</p>

    <div class="sep"></div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
      <h3 class="q-section-title">Delivery log</h3>
      <v-select v-model="logFilter" :items="[{ title: 'All', value: '' }, { title: 'Delivered', value: 'delivered' }, { title: 'Failed', value: 'failed' }, { title: 'Pending', value: 'pending' }]" variant="outlined" density="compact" hide-details style="max-width:160px" @update:model-value="onFilter" />
    </div>
    <div v-if="busy.log && !log.items.length" class="q-help py-6">Loading…</div>
    <div v-else-if="!log.items.length" class="q-soft empty"><p class="q-help">No events yet. Send a test event to see it here.</p></div>
    <div v-else>
      <div v-for="ev in log.items" :key="ev.id" class="ev">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <button type="button" class="ev__main" @click="toggleOpen(ev.id)">
           <span :class="eventPillClass(ev.event_type)">
  {{ eventLabel(ev.event_type) }}
</span>
<span class="q-help ml-2">{{ fmt(ev.created_at) }}</span>
          </button>
          <div class="flex items-center gap-2">
            <!-- <span :class="pillClass(ev.delivery_status)">{{ ev.delivery_status }}</span> -->
            <v-btn v-if="ev.delivery_status === 'failed'" class="q-btn-ghost" size="small" :loading="retrying === ev.id" @click="retry(ev)">Retry</v-btn>
          </div>
        </div>
        <pre v-if="openId === ev.id" class="payload">{{ JSON.stringify(ev.payload, null, 2) }}</pre>
      </div>
      <div v-if="pages > 1" class="flex items-center justify-between mt-3">
        <v-btn class="q-btn-ghost" size="small" :disabled="log.page === 0" @click="prevPage">Previous</v-btn>
        <span class="q-help">Page {{ log.page + 1 }} of {{ pages }}</span>
        <v-btn class="q-btn-ghost" size="small" :disabled="log.page + 1 >= pages" @click="nextPage">Next</v-btn>
      </div>
    </div>

    <ConfirmDialog v-model="rotateOpen" title="Rotate signing secret?" text="Your server must switch to the new secret straight away, or it will reject our events." confirm-text="Rotate secret" :busy="busy.rotate" @confirm="rotate" />
  </div>
</template>

<style scoped>
.sep { height: 1px; background: #e5e7eb; margin: 28px 0; }
.reveal { margin-top: 18px; padding: 14px 16px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 14px; }
.code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; background: #fff; padding: 9px 12px; border-radius: 10px; word-break: break-all; }
.code-inline { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 13px; font-weight: 500; }
.result { margin-top: 12px; padding: 10px 14px; border-radius: 12px; font-size: 13px; }
.result--ok { background: #ecfdf5; color: #047857; }
.result--bad { background: #fef2f2; color: #b91c1c; }
.ev { padding: 12px 0; border-bottom: 1px solid #f1f3f5; }
.ev__main { background: none; border: 0; cursor: pointer; text-align: left; }
.pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: #f3f4f6; color: #6b7280; }
.pill--ok { background: #ecfdf5; color: #059669; }
.pill--bad { background: #fef2f2; color: #dc2626; }
.payload { margin-top: 8px; max-height: 220px; overflow: auto; background: #f9fafb; border-radius: 10px; padding: 12px; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; }
.empty { display: flex; justify-content: center; padding: 24px; }
</style>