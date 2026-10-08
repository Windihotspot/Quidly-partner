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

<template>
  <div class="login-screen">
    <!-- Left panel -->
    <div class="login-left">
      <div class="login-form-wrap">
        <div class="login-logo">
          <v-icon icon="mdi-orbit-variant" size="32" color="#2563eb" />
        </div>

        <p class="login-subtitle">Welcome back. Please enter your details.</p>

        <v-form ref="form" @submit.prevent="handleLogin" class="mt-8">
          <div class="field-group">
            <label class="field-label">Email Address</label>
            <v-text-field
              v-model="email"
              type="email"
              placeholder="you@example.com"
              variant="outlined"
              :rules="emailRules"
              density="comfortable"
              hide-details="auto"
              class="login-field"
            />
          </div>

          <div class="field-group mt-5">
            <div class="flex items-center justify-between">
              <label class="field-label">Password</label>
              <a href="#" class="forgot-link">Forgot password?</a>
            </div>
            <v-text-field
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              variant="outlined"
              :rules="passwordRules"
              density="comfortable"
              hide-details="auto"
              class="login-field"
            >
              <template #append-inner>
                <v-icon
                  :icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                  size="20"
                  class="cursor-pointer"
                  color="#9ca3af"
                  @click="showPassword = !showPassword"
                />
              </template>
            </v-text-field>
          </div>

          <v-alert
            v-if="authStore.error"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-4"
          >
            {{ authStore.error }}
          </v-alert>

          <v-btn
            type="submit"
            block
            size="large"
            class="login-btn mt-6"
            :loading="authStore.loading"
            elevation="0"
          >
            Log in
          </v-btn>

          <p class="login-footer mt-4">
            Dont have an account?
            <router-link to="/register" class="forgot-link">Sign up here</router-link>
          </p>
        </v-form>
      </div>
    </div>

    <!-- Right panel -->
    <div class="login-right">
      <img src="@/assets/login-image.png" alt="Compliance dashboard" class="login-hero-img" />
    </div>
  </div>
</template>

<style scoped>
.login-screen {
  display: flex;
  min-height: 100vh;
  width: 100%;
  background: #ffffff;
}

.login-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-form-wrap {
  width: 100%;
  max-width: 420px;
}

.login-logo {
  margin-bottom: 2rem;
}

.login-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}

.login-subtitle {
  font-size: 0.9375rem;
  color: #64748b;
  margin-top: 0.5rem;
}

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.forgot-link {
  font-size: 0.875rem;
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
}

.forgot-link:hover {
  text-decoration: underline;
}

.login-field :deep(.v-field) {
  border-radius: 10px;
  background: #ffffff;
}

.login-field :deep(.v-field__outline) {
  --v-field-border-opacity: 1;
}

.login-field :deep(.v-field--variant-outlined .v-field__outline__start),
.login-field :deep(.v-field--variant-outlined .v-field__outline__end),
.login-field :deep(.v-field--variant-outlined .v-field__outline__notch) {
  border-color: #e2e8f0;
}

.login-field :deep(input::placeholder) {
  color: #9ca3af;
  opacity: 1;
}

.login-btn {
  background: #2563eb !important;
  color: #ffffff !important;
  font-weight: 600;
  text-transform: none;
  font-size: 1rem;
  height: 50px !important;
  border-radius: 10px;
  letter-spacing: normal;
}

.login-btn:hover {
  background: #1d4ed8 !important;
}

.login-right {
  flex: 1;
  padding: 1rem;
  display: flex;
}

.login-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 1.5rem;
}

@media (max-width: 960px) {
  .login-right {
    display: none;
  }

  .login-left {
    flex: 1 1 100%;
  }
}
</style>
