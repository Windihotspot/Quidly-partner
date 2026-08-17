<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4 py-8 md:py-12">
    <!-- Header -->
    <div class="max-w-4xl mx-auto mb-8">
      <div class="flex items-center gap-3 mb-2">
        <div class="p-2 bg-blue-100 rounded-lg">
          <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1l.993 6.024h6.007l-4.852 3.76.967 6.216L12 13.355l-4.952 3.645.967-6.216-4.852-3.76h6.007L12 1z" />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-gray-900">API Keys</h1>
      </div>
      <p class="text-gray-600 ml-11">Manage your API credentials for integrations</p>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto">
      <!-- KYC Protection Alert (if not approved) -->
      <v-alert
        v-if="!isKYCApproved"
        type="warning"
        class="mb-8"
        prominent
      >
        <template #prepend>
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </template>

        <div>
          <div class="font-semibold mb-2">KYC Verification Required</div>
          <p class="text-sm mb-4">{{ kycBlockReason }}</p>
          <v-btn
            size="small"
            to="/compliance/kyc"
            variant="tonal"
          >
            Complete Verification
          </v-btn>
        </div>
      </v-alert>

      <!-- Success Alert -->
      <v-alert
        v-if="showSuccess"
        type="success"
        class="mb-6"
        closable
        @click:close="showSuccess = false"
      >
        {{ successMessage }}
      </v-alert>

      <!-- Error Alert -->
      <v-alert
        v-if="error"
        type="error"
        class="mb-6"
        closable
        @click:close="error = null"
      >
        {{ error }}
      </v-alert>

      <!-- Main Content Card -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <!-- Content -->
        <div class="p-6 md:p-8">
          <!-- Generate New Key Section -->
          <div v-if="isKYCApproved" class="mb-8 pb-8 border-b">
            <h2 class="text-2xl font-bold text-gray-900 mb-4">Generate New API Key</h2>

            <div class="space-y-4">
              <v-select
                v-model="newKeyEnvironment"
                label="Environment *"
                :items="environments"
                :disabled="!isKYCApproved"
                variant="outlined"
                density="comfortable"
              />

              <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p class="text-sm text-blue-900 mb-3">
                  <span class="font-semibold">Test Environment:</span> Use for development and testing. Transactions are not processed.
                </p>
                <p class="text-sm text-blue-900">
                  <span class="font-semibold">Live Environment:</span> Use for production. Real transactions will be processed.
                </p>
              </div>

              <div class="flex gap-3">
                <v-btn
                  color="primary"
                  size="large"
                  :loading="loading"
                  :disabled="!isKYCApproved"
                  @click="handleGenerateKey"
                  class="flex-1"
                >
                  <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 7H7v6h6V7z" />
                    <path fill-rule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2V2a1 1 0 112 0v1a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2v1a1 1 0 11-2 0v-1h-2v1a1 1 0 11-2 0v-1H9a2 2 0 01-2-2v-2H6a1 1 0 110-2h1V9H6a1 1 0 010-2h1V5a2 2 0 012-2v-1z" clip-rule="evenodd" />
                  </svg>
                  Generate Key
                </v-btn>
              </div>
            </div>
          </div>

          <!-- New Key Display Modal -->
          <v-dialog v-model="showKeyModal" max-width="500">
            <v-card>
              <v-card-title class="bg-gradient-to-r from-green-600 to-green-500 text-white">
                API Key Generated Successfully
              </v-card-title>

              <v-card-text class="pt-6">
                <p class="text-gray-700 mb-4 font-medium">
                  Save your API key now. You won't be able to see it again!
                </p>

                <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                  <p class="text-xs text-gray-600 mb-2">API KEY</p>
                  <div class="flex items-center gap-2 font-mono text-sm break-all">
                    <code class="flex-1 text-gray-900">{{ newFullKey }}</code>
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      @click="copyToClipboard"
                    >
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 011 1v1h2V4a2 2 0 00-2-2H9a2 2 0 00-2 2v1H5V4a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-2V3a1 1 0 00-1-1H8v1z" />
                      </svg>
                    </v-btn>
                  </div>
                </div>

                <div class="bg-amber-50 rounded-lg p-4 border border-amber-200 mb-4">
                  <p class="text-sm text-amber-900">
                    <span class="font-semibold">Important:</span> Keep this key secret. Do not commit it to version control. Store it securely in your environment variables.
                  </p>
                </div>

                <v-btn
                  color="primary"
                  block
                  @click="showKeyModal = false"
                >
                  I've Saved My Key
                </v-btn>
              </v-card-text>
            </v-card>
          </v-dialog>

          <!-- Active Keys Section -->
          <div>
            <h2 class="text-2xl font-bold text-gray-900 mb-4">Active API Keys</h2>

            <v-progress-linear
              v-if="loading && apiKeys.length === 0"
              indeterminate
              color="primary"
              class="mb-6"
            />

            <div v-if="apiKeys.length === 0 && !loading" class="text-center py-12">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11-4-5 2z" />
                </svg>
              </div>
              <p class="text-gray-600 font-medium mb-2">No API Keys Yet</p>
              <p class="text-gray-500 text-sm mb-6">Generate your first API key to get started with integrations</p>
              <v-btn
                color="primary"
                variant="tonal"
                to="/compliance/kyc"
                v-if="!isKYCApproved"
              >
                Complete KYC Verification
              </v-btn>
            </div>

            <div v-else class="space-y-4">
              <APIKeyCard
                v-for="key in apiKeys"
                :key="key.id"
                :api-key="key"
                :loading="loading"
                @revoke="handleRevokeKey"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Documentation Section -->
      <div class="mt-8 bg-white rounded-xl shadow-md p-6 md:p-8">
        <h3 class="text-lg font-bold text-gray-900 mb-4">API Documentation</h3>

        <div class="space-y-4">
          <div class="flex gap-4">
            <div class="text-3xl">📚</div>
            <div>
              <p class="font-semibold text-gray-900">Complete API Reference</p>
              <p class="text-sm text-gray-600">Learn how to integrate Quidly with your application</p>
              <v-btn size="small" variant="text" external href="https://docs.quidly.com">
                View Docs →
              </v-btn>
            </div>
          </div>

          <div class="flex gap-4">
            <div class="text-3xl">🚀</div>
            <div>
              <p class="font-semibold text-gray-900">Quick Start Guide</p>
              <p class="text-sm text-gray-600">Get up and running in 5 minutes with code examples</p>
              <v-btn size="small" variant="text" external href="https://docs.quidly.com/quickstart">
                Get Started →
              </v-btn>
            </div>
          </div>

          <div class="flex gap-4">
            <div class="text-3xl">💡</div>
            <div>
              <p class="font-semibold text-gray-900">Common Use Cases</p>
              <p class="text-sm text-gray-600">Explore common integration patterns and best practices</p>
              <v-btn size="small" variant="text" external href="https://docs.quidly.com/use-cases">
                Explore →
              </v-btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePartnerAPIKeys } from '@/composables/usePartnerAPIKeys'
import APIKeyCard from '@/components/APIKeys/APIKeyCard.vue'

// Get partner ID from user
const partnerId = ref('')

const {
  loading,
  error,
  success,
  canCreateAPIKey,
  generateAPIKey,
  fetchAPIKeys,
  revokeAPIKey,
} = usePartnerAPIKeys(partnerId.value)

// State
const isKYCApproved = ref(false)
const kycBlockReason = ref('')
const apiKeys = ref<any[]>([])
const newKeyEnvironment = ref<'test' | 'live'>('test')
const showKeyModal = ref(false)
const newFullKey = ref('')
const showSuccess = ref(false)
const successMessage = ref('')

const environments = [
  { title: '🧪 Test Environment', value: 'test' },
  { title: '🚀 Live Environment', value: 'live' },
]

// Methods
const handleGenerateKey = async () => {
  const { allowed, reason } = await canCreateAPIKey()

  if (!allowed) {
    kycBlockReason.value = reason || 'You cannot generate API keys at this time'
    isKYCApproved.value = false
    return
  }

  const result = await generateAPIKey(newKeyEnvironment.value)
  if (result) {
    newFullKey.value = result.fullKey
    showKeyModal.value = true
    apiKeys.value.unshift(result.keyData)
    successMessage.value = 'API Key generated successfully!'
    showSuccess.value = true
    newKeyEnvironment.value = 'test'
  }
}

const handleRevokeKey = async (keyId: string) => {
  if (!confirm('Are you sure? This key will no longer work.')) {
    return
  }

  await revokeAPIKey(keyId, 'Revoked by partner')
  apiKeys.value = apiKeys.value.filter(key => key.id !== keyId)
  successMessage.value = 'API Key revoked successfully'
  showSuccess.value = true
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(newFullKey.value)
    successMessage.value = 'Copied to clipboard!'
    showSuccess.value = true
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Initialize
onMounted(async () => {
  // Get partner ID from user session or route
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id) {
    partnerId.value = user.id
  }

  // Check KYC status
  const { allowed, reason } = await canCreateAPIKey()
  isKYCApproved.value = allowed
  if (!allowed) {
    kycBlockReason.value = reason || 'Please complete KYC verification'
  }

  // Load API keys
  const keys = await fetchAPIKeys()
  apiKeys.value = keys
})
</script>