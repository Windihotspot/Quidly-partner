<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import SettingsProfile from '@/components/settings/SettingsProfile.vue'
import SettingsPayout from '@/components/settings/SettingsPayout.vue'
import SettingsWebhooks from '@/components/settings/SettingsWebhook.vue'
import SettingsNotifications from '@/components/settings/SettingsNotifications.vue'
import SettingsSecurity from '@/components/settings/SettingsSecurity.vue'
import { partnerSettingsService } from '@/services/partnerSettingsService'
import { apiError } from '@/services/eventsService'

// adjust to your router
const ROUTES = { kyc: '/kyc', apiKeys: '/api-keys' }

const router = useRouter()

const TABS = [
  { key: 'profile', label: 'Profile', icon: 'mdi-storefront-outline' },
  { key: 'payout', label: 'Payouts', icon: 'mdi-bank-outline' },
  { key: 'webhooks', label: 'Webhooks', icon: 'mdi-webhook' },
  { key: 'notifications', label: 'Notifications', icon: 'mdi-bell-outline' },
  { key: 'security', label: 'Security', icon: 'mdi-shield-lock-outline' },
]

const state = ref(null)
const tab = ref('profile')
const loading = ref(true)
const error = ref('')
const toast = ref({ show: false, text: '' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    state.value = await partnerSettingsService.get()
  } catch (e) {
    error.value = apiError(e, 'Could not load your settings.')
  } finally {
    loading.value = false
  }
}
onMounted(load)

// every action returns the full settings state, so tabs just hand it back up
const onState = (s) => { state.value = s }
const notify = (text) => { toast.value = { show: true, text } }

const KYC = {
  approved: ['Verified', 'kyc kyc--ok'],
  submitted: ['Under review', 'kyc kyc--info'],
  under_review: ['Under review', 'kyc kyc--info'],
  resubmission_required: ['Action needed', 'kyc kyc--warn'],
  rejected: ['Rejected', 'kyc kyc--bad'],
  suspended: ['Suspended', 'kyc kyc--bad'],
  not_started: ['Not verified', 'kyc'],
}
const kyc = computed(() => KYC[state.value?.kyc_status] ?? KYC.not_started)
const goKyc = () => router.push(ROUTES.kyc)
const goKeys = () => router.push(ROUTES.apiKeys)
</script>

<template>
  <MainLayout class="m-4" title="Settings" subtitle="Manage your business, payouts, webhooks and account security.">
    <div v-if="loading" class="py-24 text-center"><v-progress-circular indeterminate color="#2b7fff" /></div>

    <div v-else-if="error" class="py-16 text-center">
      <p class="q-error mb-4">{{ error }}</p>
      <v-btn class="q-btn-ghost" @click="load">Try again</v-btn>
    </div>

    <div v-else-if="state" class="max-w-4xl">
      <div class="top">
        <button type="button" :class="kyc[1]" @click="goKyc">
          <i class="mdi mdi-shield-check-outline"></i> Verification: {{ kyc[0] }}
        </button>
        <v-btn class="q-btn-ghost" prepend-icon="mdi-key-outline" @click="goKeys">API keys</v-btn>
      </div>

<v-tabs
  v-model="tab"
  color="#2b7fff"
  class="settings-tabs mb-5"
  align-tabs="start"
  show-arrows
  density="comfortable"
>
  <v-tab
    v-for="t in TABS"
    :key="t.key"
    :value="t.key"
    class="settings-tab"
  >
    <v-icon :icon="t.icon" size="20" class="mr-2" />
    {{ t.label }}
  </v-tab>
</v-tabs>


      <div class="panel">
        <SettingsProfile v-if="tab === 'profile'" :state="state" @saved="onState" @notify="notify" />
        <SettingsPayout v-else-if="tab === 'payout'" :state="state" @saved="onState" @notify="notify" />
        <SettingsWebhooks v-else-if="tab === 'webhooks'" :state="state" @saved="onState" @notify="notify" />
        <SettingsNotifications v-else-if="tab === 'notifications'" :state="state" @saved="onState" @notify="notify" />
        <SettingsSecurity v-else @notify="notify" />
      </div>

      <p class="q-help text-center mt-6">Need help? Email support@quidly.com</p>
    </div>

    <v-snackbar v-model="toast.show" timeout="3200">{{ toast.text }}</v-snackbar>
  </MainLayout>
</template>

<style scoped>
.top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.kyc { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 99px; border: 0; cursor: pointer; background: #f3f4f6; color: #4b5563; }
.kyc--ok { background: #ecfdf5; color: #059669; }
.kyc--info { background: #eff6ff; color: #2b7fff; }
.kyc--warn { background: #fffbeb; color: #b45309; }
.kyc--bad { background: #fef2f2; color: #dc2626; }
.tabs { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 18px; }
.tab { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 0; border-radius: 99px; background: none; color: #6b7280; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.tab:hover { background: #f3f4f6; }
.tab--on { background: #2b7fff; color: #fff; }
.panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 28px; }
@media (max-width: 640px) { .panel { padding: 18px; } .tab span { display: none; } .tab--on span { display: inline; } }
.settings-tabs {
  border-bottom: 1px solid #e5e7eb;
  background: transparent;
}

.settings-tabs :deep(.v-tab) {
  min-width: auto;
  padding-inline: 18px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: normal;
  text-transform: none;
  color: #6b7280;
}

.settings-tabs :deep(.v-tab--selected) {
  color: #2b7fff;
}

.settings-tabs :deep(.v-tab__slider) {
  height: 3px;
  border-radius: 3px 3px 0 0;
}

.panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 28px;
}

@media (max-width: 640px) {
  .panel {
    padding: 18px;
  }

  .settings-tabs :deep(.v-tab) {
    padding-inline: 12px;
    font-size: 12px;
  }
}
</style>