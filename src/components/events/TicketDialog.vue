<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { eventsService, apiError } from '@/services/eventsService'
import { ORDER_LIMITS } from '@/lib/eventHelpers'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  eventId: { type: String, required: true },
  ticket: { type: Object, default: null }, // null = create, object = edit
})
const emit = defineEmits(['update:modelValue', 'saved'])

const stage = ref('choose') // 'choose' | 'form'
const kind = ref('single')
const saving = ref(false)
const error = ref('')
const errors = reactive({})

const form = reactive({
  isFree: false,
  inviteOnly: false,
  name: '',
  qtyMode: 'unlimited',
  quantity: null,
  price: null,
  maxPerOrder: 5,
  description: '',
  groupSize: 2,
})

const editing = computed(() => !!props.ticket)
// Once tickets have sold, the server blocks price / free / kind changes.
const locked = computed(() => editing.value && props.ticket.quantity_sold > 0)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    error.value = ''
    Object.keys(errors).forEach((k) => delete errors[k])
    const t = props.ticket
    if (t) {
      stage.value = 'form'
      kind.value = t.kind
      Object.assign(form, {
        isFree: t.is_free, inviteOnly: t.invite_only, name: t.name,
        qtyMode: t.quantity === null ? 'unlimited' : 'limited', quantity: t.quantity,
        price: t.is_free ? null : Number(t.price), maxPerOrder: t.max_per_order,
        description: t.description ?? '', groupSize: t.group_size ?? 2,
      })
    } else {
      stage.value = 'choose'
      kind.value = 'single'
      Object.assign(form, {
        isFree: false, inviteOnly: false, name: '', qtyMode: 'unlimited', quantity: null,
        price: null, maxPerOrder: 5, description: '', groupSize: 2,
      })
    }
  },
)

function close() {
  emit('update:modelValue', false)
}

function validate() {
  Object.keys(errors).forEach((k) => delete errors[k])
  if (!form.name.trim()) errors.name = 'Enter a ticket name.'
  if (form.qtyMode === 'limited') {
    const q = Number(form.quantity)
    if (!Number.isInteger(q) || q < 1) errors.quantity = 'Enter a quantity of 1 or more.'
    else if (editing.value && q < props.ticket.quantity_sold) errors.quantity = `${props.ticket.quantity_sold} already sold or reserved.`
  }
  if (!form.isFree) {
    const p = Number(form.price)
    if (!Number.isFinite(p) || p <= 0) errors.price = 'Enter a price greater than 0.'
  }
  if (kind.value === 'group') {
    const g = Number(form.groupSize)
    if (!Number.isInteger(g) || g < 2 || g > 100) errors.groupSize = 'Group size must be 2 to 100.'
  }
  if (!form.description.trim()) errors.description = 'Describe this ticket.'
  return Object.keys(errors).length === 0
}

async function save() {
  if (!validate()) return
  saving.value = true
  error.value = ''
  const payload = {
    name: form.name.trim(),
    description: form.description.trim(),
    kind: kind.value,
    group_size: kind.value === 'group' ? Number(form.groupSize) : null,
    is_free: form.isFree,
    invite_only: form.inviteOnly,
    price: form.isFree ? 0 : Number(form.price),
    quantity: form.qtyMode === 'unlimited' ? null : Number(form.quantity),
    max_per_order: form.maxPerOrder,
  }
  try {
    const res = editing.value
      ? await eventsService.tickets.update(props.eventId, props.ticket.id, payload)
      : await eventsService.tickets.create(props.eventId, payload)
    emit('saved', res.ticket_types)
    close()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" :max-width="stage === 'choose' ? 600 : 500" scrollable @update:model-value="(v) => emit('update:modelValue', v)">
    <!-- Step 1: choose type -->
    <v-card v-if="stage === 'choose'" class="!rounded-xl">
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        <span class="text-lg font-semibold mx-auto">Create ticket</span>
        <v-btn icon="mdi-close" size="small" variant="text" @click="close" />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-6">
        <div class="grid grid-cols-2 gap-4">
          <button type="button" class="kind-card" :class="{ 'kind-card--on': kind === 'single' }" @click="kind = 'single'">
            <i class="mdi mdi-ticket-confirmation-outline kind-icon"></i>
            <p class="font-bold mt-3">Single ticket</p>
            <p class="text-sm">This ticket admits one person.</p>
            <span class="kind-radio" :class="{ 'kind-radio--on': kind === 'single' }"></span>
          </button>
          <button type="button" class="kind-card" :class="{ 'kind-card--on': kind === 'group' }" @click="kind = 'group'">
            <i class="mdi mdi-ticket-outline kind-icon"></i>
            <p class="font-bold mt-3">Group ticket</p>
            <p class="text-sm">This ticket admits more than one person.</p>
            <span class="kind-radio" :class="{ 'kind-radio--on': kind === 'group' }"></span>
          </button>
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4">
        <v-btn block size="large" class="q-btn-primary" @click="stage = 'form'">Continue</v-btn>
      </v-card-actions>
    </v-card>

    <!-- Step 2: form -->
    <v-card v-else class="!rounded-xl">
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        <span class="text-lg font-semibold mx-auto">{{ editing ? 'Edit' : 'Create' }} {{ kind }} ticket</span>
        <v-btn icon="mdi-close" size="small" variant="text" @click="close" />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-5">
        <p class="font-semibold mb-3">What type of ticket is it?</p>
        <div class="d-flex align-center gap-3 mb-5">
          <button type="button" class="type-btn" :class="{ 'type-btn--on': form.isFree }" :disabled="locked" @click="form.isFree = true">Free</button>
          <button type="button" class="type-btn" :class="{ 'type-btn--on': !form.isFree }" :disabled="locked" @click="form.isFree = false">Paid</button>
          <v-checkbox v-model="form.inviteOnly" label="Invite-only" density="compact" hide-details color="#2b7fff" />
        </div>
        <p v-if="locked" class="q-help mb-4">Tickets have been sold, so free/paid, price and type can no longer change.</p>

        <span class="q-label q-req">Ticket name</span>
        <v-text-field
          v-model="form.name"
          variant="outlined"
          density="comfortable"
          color="#2b7fff"
          counter="75"
          maxlength="75"
          :error-messages="errors.name"
          class="mb-3"
        />

        <span class="q-label q-req">Ticket quantity</span>
        <div class="grid gap-3 mb-3" style="grid-template-columns: 1fr 1fr">
          <v-select
            v-model="form.qtyMode"
            :items="[{ title: 'Unlimited quantity', value: 'unlimited' }, { title: 'Limited quantity', value: 'limited' }]"
            variant="outlined"
            density="comfortable"
            color="#2b7fff"
            hide-details
          />
          <v-text-field
            v-model="form.quantity"
            type="number"
            min="1"
            :placeholder="form.qtyMode === 'unlimited' ? '∞' : 'Quantity'"
            :disabled="form.qtyMode === 'unlimited'"
            variant="outlined"
            density="comfortable"
            color="#2b7fff"
            hide-details
          />
        </div>
        <p v-if="errors.quantity" class="q-error mb-3">{{ errors.quantity }}</p>

        <template v-if="kind === 'group'">
          <span class="q-label q-req">People admitted per ticket</span>
          <v-text-field
            v-model="form.groupSize"
            type="number"
            min="2"
            max="100"
            variant="outlined"
            density="comfortable"
            color="#2b7fff"
            :disabled="locked"
            :error-messages="errors.groupSize"
            class="mb-3"
          />
        </template>

        <span class="q-label q-req">Ticket price</span>
        <div class="grid gap-3 mb-3" style="grid-template-columns: 90px 1fr">
          <div class="naira-box">₦</div>
          <v-text-field
            v-model="form.price"
            type="number"
            min="0"
            :placeholder="form.isFree ? '0' : 'Price'"
            :disabled="form.isFree || locked"
            variant="outlined"
            density="comfortable"
            color="#2b7fff"
            hide-details
          />
        </div>
        <p v-if="errors.price" class="q-error mb-3">{{ errors.price }}</p>

        <span class="q-label q-req">Order limit (per person)</span>
        <v-select v-model="form.maxPerOrder" :items="ORDER_LIMITS" variant="outlined" density="comfortable" color="#2b7fff" hide-details class="mb-3" />

        <span class="q-label q-req">Ticket description</span>
        <v-textarea
          v-model="form.description"
          rows="3"
          variant="outlined"
          color="#2b7fff"
          counter="280"
          maxlength="280"
          :error-messages="errors.description"
        />

        <p v-if="error" class="q-error mt-2">{{ error }}</p>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 gap-3">
        <v-btn class="q-btn-ghost flex-1" size="large" @click="close">Cancel</v-btn>
        <v-btn class="q-btn-primary flex-1" size="large" :loading="saving" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.kind-card { position: relative; text-align: center; padding: 28px 16px 24px; border: 1px solid #d1d5db; border-radius: 12px; background: #fff; cursor: pointer; color: #2b3e50; }
.kind-card--on { border-color: #2b7fff; color: #2b7fff; }
.kind-icon { font-size: 40px; }
.kind-radio { display: inline-block; width: 22px; height: 22px; border: 1.5px solid #d1d5db; border-radius: 999px; margin-top: 14px; position: relative; }
.kind-radio--on { border-color: #2b7fff; background: #2b7fff; }
.kind-radio--on::after { content: ''; position: absolute; inset: 7px; background: #fff; border-radius: 999px; }
.type-btn { padding: 12px 28px; border-radius: 10px; border: 1px solid #d1d5db; background: #fff; color: #4b5563; font-weight: 600; cursor: pointer; min-width: 110px; }
.type-btn--on { background: #eaf2ff; border-color: #eaf2ff; color: #2b7fff; }
.type-btn:disabled { opacity: .6; cursor: not-allowed; }
.naira-box { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #4b5563; }
</style>
