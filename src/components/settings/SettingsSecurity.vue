<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ConfirmDialog from '@/components/settings/ConfirmDialog.vue'
import { partnerSettingsService as api, fieldOf } from '@/services/partnerSettingsService'
import { apiError } from '@/services/eventsService'

const emit = defineEmits(['notify'])

const form = reactive({ current: '', next: '', confirm: '' })
const showPw = ref(false)
const busy = ref(false)
const error = ref('')
const errField = ref(null)
const othersOpen = ref(false)
const othersBusy = ref(false)
const activity = ref([])

const rules = computed(() => [
  { ok: form.next.length >= 8, text: 'At least 8 characters' },
  { ok: /[a-z]/.test(form.next) && /[A-Z]/.test(form.next), text: 'Upper and lower case letters' },
  { ok: /\d/.test(form.next), text: 'A number' },
  { ok: !!form.next && form.next === form.confirm, text: 'Both entries match' },
])
const valid = computed(() => !!form.current && rules.value.every((r) => r.ok))

const LABELS = {
  'profile.updated': 'Profile updated',
  'webhook.updated': 'Webhook URL updated',
  'webhook.removed': 'Webhook removed',
  'webhook.secret_rotated': 'Webhook secret rotated',
  'password.changed': 'Password changed',
  'sessions.signed_out_others': 'Signed out other devices',
  'payout.saved': 'Payout account changed',
  'payout.removed': 'Payout account removed',
}
const label = (a) => LABELS[a] ?? a
const fmt = (d) => new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })

async function loadActivity() {
  try {
    activity.value = (await api.auditLogs()).items
  } catch {
    activity.value = []
  }
}
onMounted(loadActivity)

async function save() {
  busy.value = true
  error.value = ''
  errField.value = null
  try {
    await api.changePassword(form.current, form.next)
    Object.assign(form, { current: '', next: '', confirm: '' })
    emit('notify', 'Password changed. Other devices were signed out.')
    loadActivity()
  } catch (e) {
    error.value = apiError(e)
    errField.value = fieldOf(e)
  } finally {
    busy.value = false
  }
}

async function signOutOthers() {
  othersBusy.value = true
  try {
    await api.signOutOthers()
    othersOpen.value = false
    emit('notify', 'Other devices signed out')
    loadActivity()
  } catch (e) {
    othersOpen.value = false
    error.value = apiError(e)
  } finally {
    othersBusy.value = false
  }
}
const togglePw = () => { showPw.value = !showPw.value }
</script>

<template>
  <div>
    <h2 class="q-section-title">Change password</h2>
    <p class="q-help mb-5">You will stay signed in here. Every other device is signed out.</p>

    <div class="max-w-md">
      <v-text-field v-model="form.current" :type="showPw ? 'text' : 'password'" label="Current password" autocomplete="current-password" variant="outlined" density="comfortable" color="#2b7fff" :error-messages="errField === 'current_password' ? error : ''" :append-inner-icon="showPw ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" @click:append-inner="togglePw" />
      <v-text-field v-model="form.next" :type="showPw ? 'text' : 'password'" label="New password" autocomplete="new-password" variant="outlined" density="comfortable" color="#2b7fff" :error-messages="errField === 'new_password' ? error : ''" />
      <v-text-field v-model="form.confirm" :type="showPw ? 'text' : 'password'" label="Confirm new password" autocomplete="new-password" variant="outlined" density="comfortable" color="#2b7fff" />
      <ul class="rules">
        <li v-for="r in rules" :key="r.text" :class="{ on: r.ok }"><i class="mdi" :class="r.ok ? 'mdi-check-circle' : 'mdi-circle-outline'"></i> {{ r.text }}</li>
      </ul>
      <p v-if="error && !errField" class="q-error mt-2">{{ error }}</p>
    </div>
    <div class="flex justify-end mt-6">
      <v-btn class="q-btn-primary" size="large" min-width="180" :disabled="!valid" :loading="busy" @click="save">Update password</v-btn>
    </div>

    <div class="sep"></div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="q-section-title">Other devices</h3>
        <p class="q-help">Sign out everywhere except this browser.</p>
      </div>
      <v-btn class="q-btn-ghost" @click="othersOpen = true">Sign out other devices</v-btn>
    </div>

    <div class="sep"></div>
    <h3 class="q-section-title mb-2">Recent activity</h3>
    <p v-if="!activity.length" class="q-help">Changes to your profile, payouts, webhooks and password will appear here.</p>
    <div v-for="a in activity" :key="a.id" class="act">
      <span class="font-semibold">{{ label(a.action) }}</span>
      <span class="q-help">{{ fmt(a.created_at) }}<template v-if="a.ip"> · {{ a.ip }}</template></span>
    </div>

    <ConfirmDialog v-model="othersOpen" title="Sign out other devices?" text="You stay signed in on this browser." confirm-text="Sign out others" :busy="othersBusy" @confirm="signOutOthers" />
  </div>
</template>

<style scoped>
.sep { height: 1px; background: #e5e7eb; margin: 28px 0; }
.rules { list-style: none; padding: 0; margin: 0; font-size: 13px; color: #9ca3af; display: grid; gap: 4px; }
.rules .on { color: #059669; }
.act { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; padding: 10px 0; border-bottom: 1px solid #f1f3f5; font-size: 14px; }
</style>