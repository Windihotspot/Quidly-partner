<script setup>
import { reactive, ref, computed } from 'vue'
import { mockPartnerProfile, simulateDelay } from '@/lib/mockData'
import MainLayout from '@/layouts/MainLayout.vue'

const profile = reactive({ ...mockPartnerProfile })
const passwords = reactive({ current: '', next: '', confirm: '' })

const savingProfile = ref(false)
const savingPassword = ref(false)
const deactivateDialog = ref(false)
const deactivating = ref(false)
const snackbar = ref({ show: false, text: '', color: 'success' })

const passwordsMismatch = computed(() =>
  passwords.confirm.length > 0 && passwords.next !== passwords.confirm
)

async function saveProfile() {
  savingProfile.value = true
  await simulateDelay(900)
  savingProfile.value = false
  snackbar.value = { show: true, text: 'Profile updated.', color: 'success' }
}

async function changePassword() {
  if (!passwords.current || !passwords.next) return
  if (passwords.next !== passwords.confirm) {
    snackbar.value = { show: true, text: 'New passwords do not match.', color: 'error' }
    return
  }
  savingPassword.value = true
  await simulateDelay(900)
  savingPassword.value = false
  Object.assign(passwords, { current: '', next: '', confirm: '' })
  snackbar.value = { show: true, text: 'Password changed.', color: 'success' }
}

async function confirmDeactivate() {
  deactivating.value = true
  await simulateDelay(900)
  deactivating.value = false
  deactivateDialog.value = false
  snackbar.value = { show: true, text: 'Account deactivated.', color: 'error' }
}
</script>

<template>
  <MainLayout class="m-4" title="Settings" subtitle="Manage your partner profile and account security.">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <!-- Profile -->
      <div class="settings-card">
        <div class="card-header">
          <span class="icon-badge" style="background: #f5f5f5">
            <i class="mdi mdi-cog-outline" style="color: #6b7280"></i>
          </span>
          <div>
            <p class="font-display text-xl font-semibold card-title">Company profile</p>
            <p class="text-sm card-subtitle">Shown on receipts and customer-facing pages.</p>
          </div>
        </div>

        <div class="field-group">
          <p class="field-group-label">Company</p>
          <v-text-field v-model="profile.companyName" label="Company name" variant="outlined" density="comfortable" color="#2b7fff" class="mb-1" />
          <v-text-field v-model="profile.contactName" label="Contact person" variant="outlined" density="comfortable" color="#2b7fff" class="mb-1" />
        </div>

        <div class="field-group">
          <p class="field-group-label">Contact details</p>
          <v-text-field v-model="profile.email" label="Account email" variant="outlined" density="comfortable" color="#2b7fff" prepend-inner-icon="mdi-email-outline" class="mb-1" />
          <v-text-field v-model="profile.phone" label="Phone" variant="outlined" density="comfortable" color="#2b7fff" prepend-inner-icon="mdi-phone-outline" class="mb-1" />
          <v-text-field
            v-model="profile.supportEmail"
            label="Support email"
            hint="Shown to customers on ticket confirmations"
            persistent-hint
            variant="outlined"
            density="comfortable"
            color="#2b7fff"
            prepend-inner-icon="mdi-lifebuoy"
          />
        </div>

        <div class="flex justify-end mt-5">
          <v-btn class="save-btn" :loading="savingProfile" @click="saveProfile">Save changes</v-btn>
        </div>
      </div>

      <!-- Security + Danger zone -->
      <div class="flex flex-col gap-6">
        <div class="settings-card">
          <div class="card-header">
            <span class="icon-badge" style="background: #e1f5ff">
              <i class="mdi mdi-shield-lock-outline" style="color: #0284c7"></i>
            </span>
            <div>
              <p class="font-display text-xl font-semibold card-title">Security</p>
              <p class="text-sm card-subtitle">Update the password used to sign in.</p>
            </div>
          </div>

          <div class="field-group">
            <v-text-field v-model="passwords.current" label="Current password" type="password" variant="outlined" density="comfortable" color="#2b7fff" class="mb-1" />
            <v-text-field v-model="passwords.next" label="New password" type="password" variant="outlined" density="comfortable" color="#2b7fff" class="mb-1" />
            <v-text-field
              v-model="passwords.confirm"
              label="Confirm new password"
              type="password"
              variant="outlined"
              density="comfortable"
              color="#2b7fff"
              :error="passwordsMismatch"
              :error-messages="passwordsMismatch ? ['Passwords do not match'] : []"
            />
          </div>

          <div class="flex justify-end mt-5">
            <v-btn
              class="save-btn"
              :loading="savingPassword"
              :disabled="!passwords.current || !passwords.next || !passwords.confirm"
              @click="changePassword"
            >
              Change password
            </v-btn>
          </div>
        </div>

        <div class="danger-card">
          <div class="card-header">
            <span class="icon-badge" style="background: #fee2e2">
              <i class="mdi mdi-alert-outline" style="color: #dc2626"></i>
            </span>
            <div>
              <p class="font-display text-lg font-semibold" style="color: #b91c1c">Danger zone</p>
              <p class="text-sm card-subtitle">Deactivating your account disables all API access and pauses ticket sales.</p>
            </div>
          </div>

          <div class="flex justify-end mt-4">
            <v-btn variant="tonal" class="!text-[#dc2626] !bg-[#fee2e2]" @click="deactivateDialog = true">
              Deactivate account
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <v-dialog v-model="deactivateDialog" max-width="420">
      <v-card class="!rounded-xl">
        <v-card-title class="font-display text-lg" style="color: #b91c1c">Deactivate account?</v-card-title>
        <v-card-text class="text-sm text-gray-600">
          This immediately revokes all API keys and pauses ticket sales for every event. This can be reversed by contacting support.
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="deactivateDialog = false">Cancel</v-btn>
          <v-btn class="!bg-[#dc2626] !text-white" :loading="deactivating" @click="confirmDeactivate">Deactivate</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2200">{{ snackbar.text }}</v-snackbar>
  </MainLayout>
</template>

<style scoped>
.v-btn{
  text-transform: none;
}
.settings-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 24px;
}

.danger-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid #fecaca;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 24px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
}

.icon-badge {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 19px;
}

.card-title {
  color: #2b3e50;
}

.card-subtitle {
  color: #6b7280;
  margin-top: 2px;
}

.field-group {
  margin-bottom: 18px;
}

.field-group:last-of-type {
  margin-bottom: 0;
}

.field-group-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9ca3af;
  margin-bottom: 8px;
}

.save-btn {
  background: #2b7fff !important;
  color: #fff !important;
  border-radius: 10px !important;
  font-weight: 600;
}
</style>