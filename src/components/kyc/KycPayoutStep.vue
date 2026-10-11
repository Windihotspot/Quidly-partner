<script setup>
import { ref } from 'vue'
import '@/assets/quidly-events.css'
import PayoutAccountDialog from '@/components/events/PayoutAccountDialog.vue'
import ApiService from '@/services/api'
import { kycService } from '@/services/kycService'
import { apiError } from '@/services/eventsService'

const props = defineProps({ state: { type: Object, required: true } })
const emit = defineEmits(['saved', 'next', 'back'])

const dialog = ref(false)
const busy = ref(false)
const error = ref('')

async function refresh() {
  emit('saved', await kycService.get())
}

async function remove(account) {
  busy.value = true
  error.value = ''
  try {
    await ApiService.post('/payout-account', { action: 'remove', account_id: account.id })
    await refresh()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="q-section-title">Payout account</h2>
    <p class="q-help mb-5">Where your ticket sales are paid out. The account name should match the name you're verifying.</p>

    <div v-if="state.payout_accounts.length" class="grid gap-3 mb-4">
      <div v-for="a in state.payout_accounts" :key="a.id" class="acct">
        <i class="mdi mdi-bank-outline acct__icon"></i>
        <div class="flex-1">
          <p class="font-semibold">{{ a.account_name }}</p>
          <p class="q-help">{{ a.bank_name }} · {{ a.account_number }}</p>
        </div>
        <span v-if="a.is_verified" class="chip">Verified</span>
        <v-btn icon="mdi-delete-outline" size="small" variant="text" :disabled="busy" @click="remove(a)" />
      </div>
    </div>
    <div v-else class="q-soft empty">
      <i class="mdi mdi-bank-plus" style="font-size:34px;color:#2b7fff"></i>
      <p class="q-help mt-1">No payout account yet.</p>
    </div>

    <v-btn class="q-btn-ghost mt-3" prepend-icon="mdi-plus" @click="dialog = true">
      {{ state.payout_accounts.length ? 'Replace account' : 'Add payout account' }}
    </v-btn>
    <p v-if="error" class="q-error mt-2">{{ error }}</p>

    <div class="flex justify-between mt-10">
      <v-btn class="q-btn-ghost" size="large" min-width="140" @click="emit('back')">Back</v-btn>
      <v-btn class="q-btn-primary" size="large" min-width="200" @click="emit('next')">
        {{ state.payout_accounts.length ? 'Continue' : 'Skip for now' }}
      </v-btn>
    </div>

    <PayoutAccountDialog v-model="dialog" @saved="refresh" />
  </div>
</template>

<style scoped>
.acct { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; }
.acct__icon { font-size: 26px; color: #2b7fff; }
.chip { font-size: 11px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 3px 10px; border-radius: 99px; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 28px; }
</style>
