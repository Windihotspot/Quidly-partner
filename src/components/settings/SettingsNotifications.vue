<script setup>
import { reactive, ref, watch } from 'vue'
import { partnerSettingsService as api, fieldOf } from '@/services/partnerSettingsService'
import { apiError } from '@/services/eventsService'

const props = defineProps({ state: { type: Object, required: true } })
const emit = defineEmits(['saved', 'notify'])

const ROWS = [
  { key: 'notify_sale_email', label: 'Ticket sales by email', hint: 'A message for each completed purchase.' },
  { key: 'notify_sale_sms', label: 'Ticket sales by SMS', hint: 'Sent to your business phone number.' },
  { key: 'notify_payout_email', label: 'Payout updates', hint: 'When a payout is sent or fails.' },
  { key: 'notify_kyc_email', label: 'Verification updates', hint: 'When the status of your verification changes.' },
  { key: 'notify_webhook_failure_email', label: 'Webhook failures', hint: 'When we cannot reach your server.' },
  { key: 'notify_weekly_digest', label: 'Weekly summary', hint: 'Your sales and payouts, every Monday.' },
]

const form = reactive({ timezone: 'Africa/Lagos', notification_email: '' })
const flags = reactive({})
const busy = ref(false)
const error = ref('')
const errField = ref(null)

watch(() => props.state.preferences, (p) => {
  form.timezone = p.timezone
  form.notification_email = p.notification_email ?? ''
  for (const r of ROWS) flags[r.key] = !!p[r.key]
}, { immediate: true })

async function save() {
  busy.value = true
  error.value = ''
  errField.value = null
  try {
    emit('saved', await api.updatePreferences({ ...form, ...flags }))
    emit('notify', 'Preferences saved')
  } catch (e) {
    error.value = apiError(e)
    errField.value = fieldOf(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="q-section-title">Notifications</h2>
    <p class="q-help mb-3">Choose what we send you and where.</p>

    <div v-for="r in ROWS" :key="r.key" class="row">
      <div>
        <p class="font-semibold">{{ r.label }}</p>
        <p class="q-help">{{ r.hint }}</p>
      </div>
      <v-switch v-model="flags[r.key]" color="#2b7fff" hide-details density="comfortable" :aria-label="r.label" />
    </div>

    <div class="grid sm:grid-cols-2 gap-x-4 mt-6">
      <v-text-field v-model="form.notification_email" label="Send notifications to" variant="outlined" density="comfortable" color="#2b7fff" :placeholder="state.profile.email" hint="Defaults to your sign-in email." persistent-hint :error-messages="errField === 'notification_email' ? error : ''" />
      <v-select v-model="form.timezone" :items="state.catalog.timezones" label="Timezone" variant="outlined" density="comfortable" color="#2b7fff" />
    </div>

    <p v-if="error && !errField" class="q-error mt-1">{{ error }}</p>
    <div class="flex justify-end mt-6">
      <v-btn class="q-btn-primary" size="large" min-width="180" :loading="busy" @click="save">Save preferences</v-btn>
    </div>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid #f1f3f5; }
</style>