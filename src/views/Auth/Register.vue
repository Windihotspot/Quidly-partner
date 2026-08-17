<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
    <!-- Background decoration -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-0 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div class="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
    </div>

    <!-- Main Container -->
    <div class="relative">
      <div class="max-w-7xl mx-auto px-4 py-12 md:py-16">
        <!-- Header -->
        <div class="mb-12">
          <div class="flex items-center justify-center gap-3 mb-4">
            <div class="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
              <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
              </svg>
            </div>
          </div>
          <h1 class="text-center text-4xl md:text-5xl font-bold text-gray-900 mb-3">Join Quidly Partners</h1>
          <p class="text-center text-gray-600 text-lg">Get instant access to payment APIs and widget integration for your platform</p>
        </div>

        <!-- Two Column Layout -->
        <div class="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
          <!-- Left Column: Registration Form -->
          <div>
            <div class="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
                <h2 class="text-2xl font-bold">Create Account</h2>
                <p class="text-blue-100 text-sm mt-1">Sign up in 2 minutes</p>
              </div>

              <div class="px-8 py-8">
                <!-- Error Alert -->
                <v-alert
                  v-if="errorMsg"
                  type="error"
                  variant="tonal"
                  density="comfortable"
                  class="mb-6"
                  closable
                  @click:close="errorMsg = ''"
                >
                  {{ errorMsg }}
                </v-alert>

                <!-- Form -->
                <v-form ref="formRef" @submit.prevent="handleSubmit" class="space-y-4">
                  <!-- Company Name -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">Company / Platform Name *</label>
                    <v-text-field
                      v-model="form.companyName"
                      :rules="[rules.required]"
                      variant="outlined"
                      density="comfortable"
                      placeholder="Your company name"
                      class="rounded-lg"
                    />
                  </div>

                  <!-- Contact Name -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">Contact Person *</label>
                    <v-text-field
                      v-model="form.contactName"
                      :rules="[rules.required]"
                      variant="outlined"
                      density="comfortable"
                      placeholder="Your full name"
                      class="rounded-lg"
                    />
                  </div>

                  <!-- Email -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">Work Email *</label>
                    <v-text-field
                      v-model="form.email"
                      type="email"
                      :rules="[rules.required, rules.email]"
                      variant="outlined"
                      density="comfortable"
                      placeholder="your@company.com"
                      class="rounded-lg"
                    />
                  </div>

                  <!-- Phone -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">Phone Number *</label>
                    <v-text-field
                      v-model="form.phone"
                      :rules="[rules.required]"
                      variant="outlined"
                      density="comfortable"
                      placeholder="+234 (0) 800 000 0000"
                      class="rounded-lg"
                    />
                  </div>

                  <!-- Business Type -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">Business Type *</label>
                    <v-select
                      v-model="form.businessType"
                      :items="businessTypes"
                      :rules="[rules.required]"
                      variant="outlined"
                      density="comfortable"
                      placeholder="Select your business type"
                      class="rounded-lg"
                    />
                  </div>

                  <!-- Password -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">Password *</label>
                    <v-text-field
                      v-model="form.password"
                      type="password"
                      :rules="[rules.required, rules.minLen(8)]"
                      variant="outlined"
                      density="comfortable"
                      placeholder="At least 8 characters"
                      class="rounded-lg"
                    />
                  </div>

                  <!-- Confirm Password -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">Confirm Password *</label>
                    <v-text-field
                      v-model="form.confirmPassword"
                      type="password"
                      :rules="[rules.required, rules.matchPassword]"
                      variant="outlined"
                      density="comfortable"
                      placeholder="Confirm password"
                      class="rounded-lg"
                    />
                  </div>

                  <!-- Terms -->
                  <div class="pt-2">
                    <v-checkbox
                      v-model="form.agreeTerms"
                      :rules="[rules.isTrue]"
                      density="compact"
                      hide-details="auto"
                    >
                      <template #label>
                        <span class="text-sm text-gray-600">
                          I agree to Quidly's
                          <a href="#" class="text-blue-600 font-semibold hover:text-blue-700">Partner Terms</a>
                          and
                          <a href="#" class="text-blue-600 font-semibold hover:text-blue-700">API Policy</a>
                        </span>
                      </template>
                    </v-checkbox>
                  </div>

                  <!-- Submit Button -->
                  <v-btn
                    type="submit"
                    block
                    size="large"
                    :loading="loading"
                    class="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white font-semibold mt-6 !rounded-lg !h-12"
                  >
                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    Create Account
                  </v-btn>
                </v-form>

                <!-- Login Link -->
                <div class="text-center mt-6">
                  <p class="text-sm text-gray-600">
                    Already a partner?
                    <RouterLink to="/" class="text-blue-600 font-semibold hover:text-blue-700">Log in</RouterLink>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Benefits & Features -->
          <div class="space-y-6">
            <!-- Main Benefits Card -->
            <div class="bg-white rounded-2xl shadow-xl p-8 md:p-10 border-t-4 border-blue-600">
              <div class="flex items-start gap-4 mb-6">
                <div class="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-gray-900">Instant API Access</h3>
                  <p class="text-gray-600 text-sm mt-1">Get test API keys immediately after signup</p>
                </div>
              </div>

              <div class="bg-blue-50 rounded-lg p-4 mb-6">
                <p class="text-sm text-gray-700 font-medium mb-3">Start with:</p>
                <ul class="space-y-2">
                  <li class="flex items-center gap-2 text-sm text-gray-700">
                    <span class="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    Payment widget for your platform
                  </li>
                  <li class="flex items-center gap-2 text-sm text-gray-700">
                    <span class="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    Create customized Events
                  </li>
                  <li class="flex items-center gap-2 text-sm text-gray-700">
                    <span class="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    QR code ticket generation
                  </li>
                  <li class="flex items-center gap-2 text-sm text-gray-700">
                    <span class="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    Webhook notifications
                  </li>
                  <li class="flex items-center gap-2 text-sm text-gray-700">
                    <span class="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    Dashboard analytics
                  </li>
                </ul>
              </div>

              <div class="space-y-4">
                <div class="flex gap-4">
                  <div class="flex-shrink-0 text-2xl">🚀</div>
                  <div>
                    <p class="font-semibold text-gray-900 text-sm">Go Live in Minutes</p>
                    <p class="text-gray-600 text-xs mt-1">Complete KYC verification and activate live API keys</p>
                  </div>
                </div>

                <div class="flex gap-4">
                  <div class="flex-shrink-0 text-2xl">🔒</div>
                  <div>
                    <p class="font-semibold text-gray-900 text-sm">Enterprise Security</p>
                    <p class="text-gray-600 text-xs mt-1">Bank-grade encryption and compliance standards</p>
                  </div>
                </div>

                <div class="flex gap-4">
                  <div class="flex-shrink-0 text-2xl">💰</div>
                  <div>
                    <p class="font-semibold text-gray-900 text-sm">Competitive Rates</p>
                    <p class="text-gray-600 text-xs mt-1">Scale without breaking the bank</p>
                  </div>
                </div>

                <div class="flex gap-4">
                  <div class="flex-shrink-0 text-2xl">📊</div>
                  <div>
                    <p class="font-semibold text-gray-900 text-sm">Full Analytics</p>
                    <p class="text-gray-600 text-xs mt-1">Track transactions, revenue, and customer data</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                <div class="text-3xl font-bold mb-2">500+</div>
                <p class="text-blue-100 text-sm">Active Partners</p>
              </div>
              <div class="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                <div class="text-3xl font-bold mb-2">₦2B+</div>
                <p class="text-indigo-100 text-sm">Processed Monthly</p>
              </div>
            </div>

            <!-- Support CTA -->
            <div class="bg-white rounded-xl p-6 border border-gray-200">
              <p class="text-sm text-gray-600 mb-4">💬 Questions before signing up?</p>
              <div class="space-y-2">
                <a href="mailto:support@quidly.com" class="block text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Email us at support@quidly.com
                </a>
                <a href="https://calendly.com/quidly" class="block text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Schedule a demo call
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  businessType: null,
  password: '',
  confirmPassword: '',
  agreeTerms: false,
})

const businessTypes = [
  'Event Organizer',
  'Ticketing Platform',
  'Venue Management',
  'Marketplace / Aggregator',
  'Media & Entertainment',
  'Sports & Recreation',
  'Other',
]

const loading = ref(false)
const errorMsg = ref('')
const formRef = ref(null)

const rules = {
  required: (v: any) => !!v || 'This field is required.',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Enter a valid email address.',
  minLen: (n: number) => (v: string) => (v || '').length >= n || `Must be at least ${n} characters.`,
  matchPassword: (v: string) => v === form.password || 'Passwords do not match.',
  isTrue: (v: boolean) => v === true || 'You must accept the terms to continue.',
}

async function handleSubmit() {
  errorMsg.value = ''
  const { valid } = await (formRef.value as any).validate()
  if (!valid) return

  loading.value = true
  try {
    await auth.register(form)
    router.push({ name: 'dashboard' })
  } catch (err: any) {
    errorMsg.value = err.message || 'Registration failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@keyframes blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

:deep(.v-text-field .v-field) {
  @apply rounded-lg;
}

:deep(.v-select .v-field) {
  @apply rounded-lg;
}
</style>