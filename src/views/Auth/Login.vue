<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
    <!-- Background decoration -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-0 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div class="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
    </div>

    <div class="relative flex items-center justify-center min-h-screen px-4 py-12">
      <div class="w-full max-w-3xl">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="flex items-center justify-center gap-3 mb-6">
            <div class="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
              <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
              </svg>
            </div>
          </div>

          <h1 class="text-4xl font-bold text-gray-900 mb-2">Welcome to Quidly</h1>
          <p class="text-gray-600 text-lg">Partner dashboard & payment widget API</p>
        </div>

        <!-- Login Card -->
        <div class="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
            <h2 class="text-2xl font-bold">Partner Login</h2>
            <p class="text-blue-100 text-sm mt-1">Access your API keys and dashboard</p>
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
            <v-form ref="formRef" @submit.prevent="handleSubmit" class="space-y-5">
              <!-- Email Field -->
              <div>
                <label class="block text-sm font-semibold text-gray-900 mb-2">Work Email</label>
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

              <!-- Password Field -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-semibold text-gray-900">Password</label>
                  <a href="#" class="text-xs font-semibold text-blue-600 hover:text-blue-700">Forgot?</a>
                </div>
                <v-text-field
                  v-model="form.password"
                  type="password"
                  :rules="[rules.required]"
                  variant="outlined"
                  density="comfortable"
                  placeholder="••••••••"
                  class="rounded-lg"
                />
              </div>

              <!-- Remember Me -->
              <div class="flex items-center">
                <v-checkbox
                  v-model="form.remember"
                  density="compact"
                  hide-details
                >
                  <template #label>
                    <span class="text-sm text-gray-600">Keep me logged in</span>
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
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Sign In
              </v-btn>
            </v-form>

            <!-- Demo Credentials -->
            <div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p class="text-xs text-gray-600 mb-2 font-medium">🧪 Try Demo</p>
              <button
                type="button"
                @click="fillDemo"
                class="text-sm font-mono text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                demo@quidly.dev / demo1234
              </button>
            </div>

            <!-- Divider -->
            <div class="relative my-6">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-200"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500">New to Quidly?</span>
              </div>
            </div>

            <!-- Sign Up Link -->
            <v-btn
              block
              size="large"
              variant="outlined"
              to="/register"
              class="!border-2 !border-blue-600 !text-blue-600 font-semibold !rounded-lg !h-12"
            >
              <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0015.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
              </svg>
              Create Partner Account
            </v-btn>
          </div>
        </div>

        <!-- Footer -->
        <div class="text-center mt-8">
          <p class="text-sm text-gray-600">
            Questions? <a href="mailto:support@quidly.com" class="text-blue-600 font-semibold hover:text-blue-700">Contact support</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const form = ref()

const emailRules = [
  (v: string) => !!v || 'Email is required',
  (v: string) => /.+@.+\..+/.test(v) || 'Enter a valid email',
]

const passwordRules = [(v: string) => !!v || 'Password is required']

async function handleLogin() {
  const { valid } = await form.value.validate()
  if (!valid) return

  try {
    await authStore.login(email.value, password.value)
    router.push('/dashboard') // adjust to your actual post-login route
  } catch {
    // authStore.error is already set and shown via the v-alert
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
</style>