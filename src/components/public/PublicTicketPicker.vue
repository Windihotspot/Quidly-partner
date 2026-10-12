<script setup>
import { ref, reactive, computed } from 'vue'
import { publicEventService } from '@/services/publicEventService'
import { formatNaira } from '@/lib/eventHelpers'

const props = defineProps({
  eventId: { type: String, required: true },
  slug: { type: String, required: true },
  tickets: { type: Array, default: () => [] },
  ended: { type: Boolean, default: false },
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const selectedId = ref(null) // one ticket type per order
const qty = ref(0)
const buyer = reactive({ name: '', email: '', phone: '' })
const errors = reactive({})
const submitting = ref(false)
const error = ref('')
const done = ref(null) // free orders complete immediately
const sessionId = crypto.randomUUID()

const selected = computed(() => props.tickets.find((t) => t.id === selectedId.value) ?? null)
const total = computed(() => (selected.value ? Number(selected.value.price) * qty.value : 0))
const allSoldOut = computed(() => props.tickets.length > 0 && props.tickets.every((t) => t.sold_out))

const maxFor = (t) => Math.min(t.max_per_order, t.remaining ?? t.max_per_order)
const qtyFor = (t) => (selectedId.value === t.id ? qty.value : 0)
const priceLabel = (t) => (t.is_free ? 'Free' : formatNaira(t.price))

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
  if (buyer.phone && !/^[+\d][\d\s-]{6,20}$/.test(buyer.phone.trim())) errors.phone = 'Enter a valid phone number.'
  return Object.keys(errors).length === 0
}

async function submit() {
  error.value = ''
  if (!selected.value || qty.value < 1) return
  if (!validate()) return
  submitting.value = true
  try {
    const res = await publicEventService.createTransaction({
      event_id: props.eventId,
      ticket_type_id: selected.value.id,
      quantity: qty.value,
      customer: { name: buyer.name.trim(), email: buyer.email.trim(), phone: buyer.phone.trim() || undefined },
      payment_method: 'card',
      widget_session_id: sessionId,
      callback_url: `${window.location.origin}/e/${props.slug}`,
    })
    if (res.status === 'completed') done.value = res
    else if (res.authorization_url) window.location.assign(res.authorization_url)
    else error.value = 'Could not start payment. Please try again.'
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || 'Something went wrong. Please try again.'
    error.value = /not configured/i.test(msg) ? 'Card payments are not enabled yet. Please try again later.' : msg
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="picker">
    <!-- free order confirmation -->
    <div v-if="done" class="done">
      <i class="mdi mdi-check-circle"></i>
      <h3>You're in!</h3>
      <p>Order reference</p>
      <code>{{ done.reference }}</code>
      <p class="mt-3">Your ticket{{ done.tickets.length > 1 ? 's' : '' }}</p>
      <code v-for="t in done.tickets" :key="t.id" class="block">{{ t.reference }}</code>
    </div>

    <template v-else>
      <h3 class="picker__title">Tickets</h3>

      <p v-if="ended" class="notice">This event has ended.</p>
      <p v-else-if="!tickets.length" class="notice">Tickets aren't available for this event yet.</p>
      <p v-else-if="allSoldOut" class="notice">This event is sold out.</p>

      <div v-else class="tickets">
        <div v-for="t in tickets" :key="t.id" class="ticket" :class="{ 'ticket--on': selectedId === t.id, 'ticket--off': !t.on_sale }">
          <div class="ticket__info">
            <p class="ticket__name">{{ t.name }}</p>
            <p v-if="t.kind === 'group'" class="ticket__meta">Admits {{ t.group_size }} people</p>
            <p v-if="t.description" class="ticket__meta">{{ t.description }}</p>
            <p v-if="t.remaining !== null && t.remaining > 0 && t.remaining <= 10" class="ticket__low">Only {{ t.remaining }} left</p>
          </div>
          <div class="ticket__side">
            <p class="ticket__price">{{ priceLabel(t) }}</p>
            <p v-if="t.sold_out" class="ticket__sold">Sold out</p>
            <div v-else class="stepper">
              <button type="button" :disabled="qtyFor(t) === 0" @click="step(t, -1)">−</button>
              <span>{{ qtyFor(t) }}</span>
              <button type="button" :disabled="qtyFor(t) >= maxFor(t)" @click="step(t, 1)">+</button>
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
        <label>Phone <span class="opt">(optional)</span><input v-model="buyer.phone" type="tel" autocomplete="tel" /></label>
        <p v-if="errors.phone" class="err">{{ errors.phone }}</p>

        <div class="total"><span>{{ qty }} × {{ selected.name }}</span><strong>{{ total === 0 ? 'Free' : formatNaira(total) }}</strong></div>
        <p v-if="error" class="err err--box">{{ error }}</p>
        <button type="submit" class="cta" :disabled="submitting">
          {{ submitting ? 'Please wait…' : total === 0 ? 'Get free ticket' : `Pay ${formatNaira(total)}` }}
        </button>
      </form>
    </template>
  </div>
</template>

<style scoped>
.picker { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 22px; }
.picker__title { font-size: 18px; font-weight: 700; margin-bottom: 14px; }
.notice { color: var(--muted); font-size: 14px; padding: 10px 0; }
.tickets { display: grid; gap: 10px; }
.ticket { display: flex; justify-content: space-between; gap: 14px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; transition: border-color .15s ease; }
.ticket--on { border-color: var(--accent); }
.ticket--off { opacity: .55; }
.ticket__name { font-weight: 600; }
.ticket__meta { font-size: 13px; color: var(--muted); margin-top: 2px; }
.ticket__low { font-size: 12px; color: #d97706; margin-top: 4px; font-weight: 600; }
.ticket__side { text-align: right; flex-shrink: 0; }
.ticket__price { font-weight: 700; margin-bottom: 8px; }
.ticket__sold { font-size: 12px; font-weight: 700; color: #dc2626; text-transform: uppercase; }
.stepper { display: inline-flex; align-items: center; gap: 10px; }
.stepper button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--text); font-size: 18px; cursor: pointer; }
.stepper button:disabled { opacity: .35; cursor: not-allowed; }
.stepper span { min-width: 18px; text-align: center; font-weight: 600; }
.hint { font-size: 12px; color: var(--muted); }
.buyer { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); display: grid; gap: 8px; }
.buyer h4 { font-weight: 700; margin-bottom: 2px; }
.buyer label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
.buyer input { padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: transparent; color: var(--text); font-size: 15px; }
.buyer input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.opt { opacity: .7; }
.err { color: #dc2626; font-size: 12px; margin-top: -4px; }
.err--box { background: #fef2f2; border-radius: 10px; padding: 10px 12px; margin: 4px 0; }
.total { display: flex; justify-content: space-between; margin-top: 8px; font-size: 14px; }
.cta { margin-top: 6px; padding: 14px; border-radius: 12px; border: 0; background: var(--accent); color: var(--bg); font-weight: 700; font-size: 15px; cursor: pointer; }
.cta:disabled { opacity: .6; cursor: wait; }
.done { text-align: center; padding: 10px 0; }
.done i { font-size: 46px; color: #059669; }
.done h3 { font-size: 20px; font-weight: 700; margin: 6px 0 12px; }
.done p { font-size: 13px; color: var(--muted); margin-bottom: 4px; }
.done code { display: inline-block; font-family: monospace; font-size: 13px; background: rgba(127,127,127,.12); padding: 5px 10px; border-radius: 8px; margin: 2px; }
.done code.block { display: block; }
</style>
