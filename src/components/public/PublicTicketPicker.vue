<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { publicEventService } from '@/services/publicEventService'
import { runCheckout } from '@/lib/quidlyPay'
import { formatNaira } from '@/lib/eventHelpers'
import { pollPaymentStatus } from '@/services/paymentPolling'

const quidlyRef = ref('')
let pollController = null
let paymentResolved = false
let activeReference = null

const props = defineProps({
  eventId: { type: String, required: true },
  slug: { type: String, required: true },
  tickets: { type: Array, default: () => [] },
  ended: { type: Boolean, default: false }
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const selectedId = ref(null) // one ticket type per order
const qty = ref(0)
const buyer = reactive({ name: '', email: '', phone: '' })
const errors = reactive({})
const submitting = ref(false)
const error = ref('')
const notice = ref('')
const done = ref(null) // completed order (free, or paid and verified)
const waiting = ref(null) // paid but still confirming / needs review: the form stays locked so nobody pays twice
const created = ref(null) // open paid order, reused if the customer closes the widget and comes back
const sessionId = crypto.randomUUID()

const selected = computed(() => props.tickets.find((t) => t.id === selectedId.value) ?? null)
const total = computed(() => (selected.value ? Number(selected.value.price) * qty.value : 0))
const allSoldOut = computed(
  () => props.tickets.length > 0 && props.tickets.every((t) => t.sold_out)
)

const maxFor = (t) => Math.min(t.max_per_order, t.remaining ?? t.max_per_order)
const qtyFor = (t) => (selectedId.value === t.id ? qty.value : 0)
const priceLabel = (t) => (t.is_free ? 'Free' : formatNaira(t.price))

// a held order only matches the exact selection it was created for
watch([selectedId, qty, () => buyer.email, () => buyer.name], () => {
  created.value = null
})

const holdActive = () =>
  created.value && new Date(created.value.expires_at).getTime() > Date.now() + 30_000
const ctaLabel = computed(() => {
  if (submitting.value) return 'Please wait…'
  if (holdActive()) return 'Continue payment'
  return total.value === 0 ? 'Get free ticket' : `Pay ${formatNaira(total.value)}`
})

function step(t, delta) {
  if (selectedId.value !== t.id) {
    selectedId.value = t.id
    qty.value = 0
  }
  qty.value = Math.min(maxFor(t), Math.max(0, qty.value + delta))
  if (qty.value === 0) selectedId.value = null
}

function validate() {
  Object.keys(errors).forEach((k) => delete errors[k])
  if (buyer.name.trim().length < 2) errors.name = 'Enter your full name.'
  if (!EMAIL_RE.test(buyer.email.trim())) errors.email = 'Enter a valid email address.'
  if (buyer.phone && !/^[+\d][\d\s-]{6,20}$/.test(buyer.phone.trim()))
    errors.phone = 'Enter a valid phone number.'
  return Object.keys(errors).length === 0
}

function applyPaymentResult(result, reference) {
  // Ignore results belonging to an older checkout.
  if (activeReference !== reference || paymentResolved) return

  if (result.status === 'completed') {
    paymentResolved = true
    done.value = {
      ...result,
      reference: result.reference || reference,
      tickets: result.tickets || []
    }
    waiting.value = null
    created.value = null
    return
  }

  if (result.status === 'failed') {
    paymentResolved = true
    waiting.value = null
    created.value = null
    error.value = result.message || 'Your payment was not successful. Please try again.'
    return
  }

  if (result.status === 'review') {
    paymentResolved = true
    waiting.value = {
      reference,
      message: result.message || 'Your payment needs to be checked. Please do not pay again.'
    }
    created.value = null
    return
  }

  // Pending: keep checking without unlocking the checkout.
  waiting.value = {
    reference,
    message: result.message || 'We are confirming your payment. Please wait.'
  }
}

function startPaymentPolling(reference) {
  // Only one poller should run for an order.
  if (activeReference === reference && pollController) return

  pollController?.abort()
  pollController = new AbortController()
  activeReference = reference
  paymentResolved = false
  quidlyRef.value = ''

  pollPaymentStatus(reference, () => quidlyRef.value, {
    intervalMs: 3000,
    timeoutMs: 120000,
    onStatus: (result) => applyPaymentResult(result, reference)
  })
    .then((result) => {
      if (activeReference !== reference || paymentResolved) return

      if (result.status === 'pending') {
        waiting.value = {
          reference,
          message:
            result.message ||
            'Your payment is taking longer than expected to confirm. Please do not pay again.'
        }
      }
    })
    .catch((err) => {
      console.error('[checkout] payment polling stopped', err)
    })
}

onBeforeUnmount(() => {
  pollController?.abort()
})

async function pay() {
  const order = created.value
  if (!order) return

  startPaymentPolling(order.reference)

  try {
    const result = await runCheckout(order)

    // The poller may already have confirmed payment while
    // the widget was open.
    if (paymentResolved) return

    // Capture the provider reference if the widget returns one.
    quidlyRef.value = result?.quidly_ref || result?.transaction_reference || result?.reference || ''

    if (result.status === 'completed') {
      applyPaymentResult(result, order.reference)
    } else if (result.status === 'cancelled') {
      notice.value =
        'Payment window closed. If you already paid, we are still checking your payment status.'
    } else if (result.status === 'failed') {
      applyPaymentResult(result, order.reference)
    } else {
      waiting.value = {
        reference: order.reference,
        message: result.message || 'We are confirming your payment. Please do not pay again.'
      }
    }
  } catch (err) {
    // Keep polling even if the widget throws: the payment may
    // still have succeeded on the provider side.
    console.error('[checkout] widget error', err)

    if (!paymentResolved) {
      waiting.value = {
        reference: order.reference,
        message: 'We are checking whether your payment went through. Please do not pay again.'
      }
    }
  }
}

async function submit() {
  error.value = ''
  notice.value = ''
  if (!selected.value || qty.value < 1) return
  if (!validate()) return
  submitting.value = true
  try {
    if (!holdActive()) {
      const res = await publicEventService.createTransaction({
        event_id: props.eventId,
        ticket_type_id: selected.value.id,
        quantity: qty.value,
        customer: {
          name: buyer.name.trim(),
          email: buyer.email.trim(),
          phone: buyer.phone.trim() || undefined
        },
        widget_session_id: sessionId
      })
      if (res.status === 'completed') {
        done.value = res // free orders complete immediately
        return
      }
      if (!res.widget) throw new Error('Could not start payment. Please try again.')
      created.value = res
    }
    await pay()
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || 'Something went wrong. Please try again.'
    error.value = /not configured/i.test(msg)
      ? 'Payments are not enabled yet. Please try again later.'
      : msg
  } finally {
    submitting.value = false
  }
}
function testOpenQuidly() {
  const widget = window.embedQuidlyPay

  console.log('[Quidly Test] Widget:', widget)
  console.log('[Quidly Test] Available methods:', Object.keys(widget || {}))

  if (typeof widget?.initialize === 'function') {
    console.log('[Quidly Test] initialize() is available.')
    console.log('[Quidly Test] Check the console for available methods.')
  } else {
    console.warn('[Quidly Test] Quidly widget is not loaded.')
  }
}

function testCloseQuidly() {
  const widget = window.embedQuidlyPay

  console.log('[Quidly Test] Attempting close test...')
  console.log('[Quidly Test] Widget methods:', Object.keys(widget || {}))

  if (typeof widget?.close === 'function') {
    widget.close()
    console.log('[Quidly Test] close() called.')
  } else if (typeof widget?.onclose === 'function') {
    widget.onclose({ status: 'closed', reason: 'manual_test' })
    console.log('[Quidly Test] onclose() called.')
  } else {
    console.warn('[Quidly Test] No public close() or onclose() method found.')
  }
}
const confettiPieces = Array.from({ length: 42 }, (_, i) => i)
</script>

<template>
  <div class="picker">
    <!-- <div class="widget-test-controls">
      <button type="button" @click="testOpenQuidly">Test Open</button>

      <button type="button" @click="testCloseQuidly">Test Close</button>
    </div> -->
    <!-- order confirmation -->

    <!-- order confirmation -->
    <div v-if="done" class="done">
      <div class="confetti" aria-hidden="true">
        <span
          v-for="piece in confettiPieces"
          :key="piece"
          class="confetti__piece"
          :style="{
            '--x': `${(piece * 37) % 100}%`,
            '--delay': `${(piece % 12) * -0.18}s`,
            '--duration': `${2.4 + (piece % 7) * 0.25}s`,
            '--rotation': `${piece * 47}deg`
          }"
        />
      </div>

      <div class="success-icon">
        <i class="mdi mdi-check-circle"></i>
      </div>

      <h3>You're in!</h3>
      <p>Your payment is confirmed. Check your email for your tickets details</p>

      <!-- <p class="mt-3">Order reference</p>
      <code>{{ done.reference }}</code>

      <p class="mt-3">Your ticket{{ (done.tickets?.length || 0) !== 1 ? 's' : '' }}</p>
      <code v-for="t in done.tickets || []" :key="t.id || t.reference" class="block">{{
        t.reference
      }}</code> -->
    </div>

    <!-- payment received but not confirmed yet -->
    <div v-else-if="waiting" class="done">
      <i class="mdi mdi-clock-check-outline waiting__icon"></i>
      <h3>Confirming your payment</h3>
      <p>{{ waiting.message }}</p>
      <p class="mt-3">Order reference</p>
      <code>{{ waiting.reference }}</code>
      <p class="mt-3">Please do not pay again. Keep this reference if you need help.</p>
    </div>

    <template v-else>
      <h3 class="picker__title">Place an order for Tickets</h3>

      <p v-if="ended" class="notice">This event has ended.</p>
      <p v-else-if="!tickets.length" class="notice">Tickets aren't available for this event yet.</p>
      <p v-else-if="allSoldOut" class="notice">This event is sold out.</p>

      <div v-else class="tickets">
        <div
          v-for="t in tickets"
          :key="t.id"
          class="ticket"
          :class="{ 'ticket--on': selectedId === t.id, 'ticket--off': !t.on_sale }"
        >
          <div class="ticket__info">
            <p class="ticket__name">{{ t.name }}</p>
            <p v-if="t.kind === 'group'" class="ticket__meta">Admits {{ t.group_size }} people</p>
            <p v-if="t.description" class="ticket__meta">{{ t.description }}</p>
            <p
              v-if="t.remaining !== null && t.remaining > 0 && t.remaining <= 10"
              class="ticket__low"
            >
              Only {{ t.remaining }} left
            </p>
          </div>
          <div class="ticket__side">
            <p class="ticket__price">{{ priceLabel(t) }}</p>
            <p v-if="t.sold_out" class="ticket__sold">Sold out</p>
            <div v-else class="stepper">
              <button type="button" :disabled="qtyFor(t) === 0" @click="step(t, -1)">−</button>
              <span>{{ qtyFor(t) }}</span>
              <button type="button" :disabled="qtyFor(t) >= maxFor(t)" @click="step(t, 1)">
                +
              </button>
            </div>
          </div>
        </div>
        <p class="hint">One ticket type per order.</p>
      </div>

      <!-- buyer details -->
      <form v-if="selected" class="buyer" @submit.prevent="submit">
        <h4>Your details</h4>
        <label>Full name<input v-model="buyer.name" autocomplete="name" /></label>
        <p v-if="errors.name" class="err">{{ errors.name }}</p>
        <label>Email<input v-model="buyer.email" type="email" autocomplete="email" /></label>
        <p v-if="errors.email" class="err">{{ errors.email }}</p>
        <label
          >Phone <span class="opt">(optional)</span
          ><input v-model="buyer.phone" type="tel" autocomplete="tel"
        /></label>
        <p v-if="errors.phone" class="err">{{ errors.phone }}</p>

        <div class="total">
          <span>{{ qty }} × {{ selected.name }}</span
          ><strong>{{ total === 0 ? 'Free' : formatNaira(total) }}</strong>
        </div>
        <p v-if="notice" class="note">{{ notice }}</p>
        <p v-if="error" class="err err--box">{{ error }}</p>
        <button type="submit" class="cta" :disabled="submitting">{{ ctaLabel }}</button>
      </form>
    </template>
  </div>
</template>

<style scoped>
.widget-test-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.widget-test-controls button {
  padding: 10px 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  cursor: pointer;
}
.picker {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 22px;
}
.picker__title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 14px;
}
.notice {
  color: var(--muted);
  font-size: 14px;
  padding: 10px 0;
}
.tickets {
  display: grid;
  gap: 10px;
}
.ticket {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  transition: border-color 0.15s ease;
}
.ticket--on {
  border-color: var(--accent);
}
.ticket--off {
  opacity: 0.55;
}
.ticket__name {
  font-weight: 600;
}
.ticket__meta {
  font-size: 13px;
  color: var(--muted);
  margin-top: 2px;
}
.ticket__low {
  font-size: 12px;
  color: #d97706;
  margin-top: 4px;
  font-weight: 600;
}
.ticket__side {
  text-align: right;
  flex-shrink: 0;
}
.ticket__price {
  font-weight: 700;
  margin-bottom: 8px;
}
.ticket__sold {
  font-size: 12px;
  font-weight: 700;
  color: #dc2626;
  text-transform: uppercase;
}
.stepper {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.stepper button {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
}
.stepper button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.stepper span {
  min-width: 18px;
  text-align: center;
  font-weight: 600;
}
.hint {
  font-size: 12px;
  color: var(--muted);
}
.buyer {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  display: grid;
  gap: 8px;
}
.buyer h4 {
  font-weight: 700;
  margin-bottom: 2px;
}
.buyer label {
  display: grid;
  gap: 4px;
  font-size: 13px;
  color: var(--muted);
}
.buyer input {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  font-size: 15px;
}
.buyer input:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}
.opt {
  opacity: 0.7;
}
.err {
  color: #dc2626;
  font-size: 12px;
  margin-top: -4px;
}
.err--box {
  background: #fef2f2;
  border-radius: 10px;
  padding: 10px 12px;
  margin: 4px 0;
}
.note {
  background: rgba(127, 127, 127, 0.12);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  margin: 4px 0;
}
.total {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 14px;
}
.cta {
  margin-top: 6px;
  padding: 14px;
  border-radius: 12px;
  border: 0;
  background: var(--accent);
  color: var(--bg);
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}
.cta:disabled {
  opacity: 0.6;
  cursor: wait;
}

.done {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  padding: 32px 12px;
  animation: success-enter 0.55s ease-out both;
}

.success-icon {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: #d1fae5;
  animation: success-pop 0.65s cubic-bezier(0.2, 1.5, 0.5, 1) both;
}

.success-icon i {
  font-size: 56px;
  color: #059669;
}

.done h3,
.done p,
.done code {
  position: relative;
  z-index: 2;
}

.confetti {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.confetti__piece {
  position: absolute;
  left: var(--x);
  top: -18px;
  width: 8px;
  height: 13px;
  border-radius: 2px;
  background: hsl(calc(var(--rotation) + 140deg), 80%, 55%);
  animation: confetti-fall var(--duration) var(--delay) ease-in both;
}

.confetti__piece:nth-child(3n) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.confetti__piece:nth-child(3n + 1) {
  background: #f59e0b;
}

.confetti__piece:nth-child(3n + 2) {
  background: #ec4899;
}

@keyframes confetti-fall {
  0% {
    transform: translate3d(0, -10px, 0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate3d(24px, 360px, 0) rotate(680deg);
    opacity: 0;
  }
}

@keyframes success-pop {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  70% {
    transform: scale(1.12);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes success-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .done,
  .success-icon,
  .confetti__piece {
    animation: none !important;
  }

  .confetti__piece {
    display: none;
  }
}
</style>
