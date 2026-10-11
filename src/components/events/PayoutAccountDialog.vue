<script setup>
import { ref, watch } from 'vue'
import { eventsService, apiError } from '@/services/eventsService'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue', 'saved'])

const banks = ref([])
const loadingBanks = ref(false)
const bankSlug = ref(null)
const accountNumber = ref('')
const accountName = ref('')
const resolving = ref(false)
const saving = ref(false)
const error = ref('')
let resolveToken = 0

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    bankSlug.value = null
    accountNumber.value = ''
    accountName.value = ''
    error.value = ''
    if (!banks.value.length) {
      loadingBanks.value = true
      try {
        banks.value = (await eventsService.payout.banks()).banks ?? []
      } catch (e) {
        error.value = apiError(e, 'Could not load banks.')
      } finally {
        loadingBanks.value = false
      }
    }
  },
)

// Name enquiry as soon as bank + 10 digits are present
watch([bankSlug, accountNumber], async ([code, num]) => {
  accountName.value = ''
  error.value = ''
  if (!code || !/^\d{10}$/.test(num)) return
  const token = ++resolveToken
  resolving.value = true
  try {
    const res = await eventsService.payout.resolve(code, num)
    if (token === resolveToken) accountName.value = res.account_name
  } catch (e) {
    if (token === resolveToken) error.value = apiError(e, 'Could not verify this account.')
  } finally {
    if (token === resolveToken) resolving.value = false
  }
})

function onNumber(v) {
  accountNumber.value = String(v ?? '').replace(/\D/g, '').slice(0, 10)
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const res = await eventsService.payout.save(bankSlug.value, accountNumber.value)
    emit('saved', res)
    emit('update:modelValue', false)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="480" @update:model-value="(v) => emit('update:modelValue', v)">
    <v-card class="!rounded-xl">
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        <span class="text-lg font-semibold mx-auto">Add NGN Payout Account</span>
        <v-btn icon="mdi-close" size="small" variant="text" @click="emit('update:modelValue', false)" />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-5">
        <div class="q-info mb-5">You can edit this information later.</div>

        <span class="q-label q-req">Payment Method</span>
        <v-select
          model-value="Bank Transfer"
          :items="['Bank Transfer']"
          variant="outlined"
          density="comfortable"
          disabled
          hide-details
          class="mb-5"
        />

        <p class="font-semibold mb-3">Account information</p>

        <span class="q-label q-req">Bank name</span>
        <v-autocomplete
          v-model="bankSlug"
          :items="banks"
          item-title="name"
          item-value="slug"
          :loading="loadingBanks"
          placeholder="Select bank"
          variant="outlined"
          density="comfortable"
          color="#2b7fff"
          hide-details
          class="mb-4"
        />

        <span class="q-label q-req">Account number</span>
        <v-text-field
          :model-value="accountNumber"
          placeholder="10-digit account number"
          inputmode="numeric"
          variant="outlined"
          density="comfortable"
          color="#2b7fff"
          hide-details
          class="mb-4"
          @update:model-value="onNumber"
        />

        <span class="q-label q-req">Account name</span>
        <v-text-field
          :model-value="accountName"
          :placeholder="resolving ? 'Verifying…' : 'Filled in automatically'"
          :loading="resolving"
          readonly
          variant="outlined"
          density="comfortable"
          hide-details
        />
        <p v-if="error" class="q-error mt-3">{{ error }}</p>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 gap-3">
        <v-btn class="q-btn-ghost flex-1" size="large" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn class="q-btn-primary flex-1" size="large" :disabled="!accountName" :loading="saving" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
