<script setup>
import { ref } from 'vue'
import PayoutAccountDialog from '@/components/events/PayoutAccountDialog.vue'
import ConfirmDialog from '@/components/settings/ConfirmDialog.vue'
import { partnerSettingsService as api } from '@/services/partnerSettingsService'
import { apiError } from '@/services/eventsService'

const props = defineProps({ state: { type: Object, required: true } })
const emit = defineEmits(['saved', 'notify'])

const dialog = ref(false)
const removing = ref(null)
const confirmOpen = ref(false)
const busy = ref(false)
const error = ref('')

const refresh = async () => emit('saved', await api.get())
const onSaved = async () => {
  await refresh()
  emit('notify', 'Payout account updated')
}
const askRemove = (a) => { removing.value = a; confirmOpen.value = true }

async function remove() {
  busy.value = true
  error.value = ''
  try {
    await api.removePayout(removing.value.id)
    confirmOpen.value = false
    await refresh()
    emit('notify', 'Payout account removed')
  } catch (e) {
    confirmOpen.value = false
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="q-section-title">Payout account</h2>
    <p class="q-help mb-5">Ticket sales are paid to this account. The account name should match the name you verified.</p>

    <div v-if="state.payout_accounts.length" class="grid gap-3 mb-4">
      <div v-for="a in state.payout_accounts" :key="a.id" class="acct">
        <i class="mdi mdi-bank-outline acct__icon"></i>
        <div class="flex-1 min-w-0">
          <p class="font-semibold truncate">{{ a.account_name }}</p>
          <p class="q-help">{{ a.bank_name }} · {{ a.account_number }}</p>
        </div>
        <span v-if="a.is_verified" class="chip">Verified</span>
        <v-btn icon="mdi-delete-outline" size="small" variant="text" aria-label="Remove account" @click="askRemove(a)" />
      </div>
    </div>
    <div v-else class="q-soft empty">
      <i class="mdi mdi-bank-plus" style="font-size:34px;color:#2b7fff"></i>
      <p class="q-help mt-1">No payout account yet. Add one to receive your earnings.</p>
    </div>

    <p v-if="state.kyc_status !== 'approved'" class="q-help mb-3">Payouts start once your business verification is approved.</p>
    <v-btn class="q-btn-ghost" prepend-icon="mdi-plus" @click="dialog = true">
      {{ state.payout_accounts.length ? 'Replace account' : 'Add payout account' }}
    </v-btn>
    <p v-if="error" class="q-error mt-2">{{ error }}</p>

    <PayoutAccountDialog v-model="dialog" @saved="onSaved" />
    <ConfirmDialog v-model="confirmOpen" title="Remove payout account?" text="We cannot pay you out until you add another account." confirm-text="Remove" :busy="busy" @confirm="remove" />
  </div>
</template>

<style scoped>
.acct { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; }
.acct__icon { font-size: 26px; color: #2b7fff; }
.chip { font-size: 11px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 3px 10px; border-radius: 99px; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 28px; margin-bottom: 12px; }
</style>