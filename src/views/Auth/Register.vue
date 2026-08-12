<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
// import ApiService from '@/services/api'
import { authService } from '@/services/authServices.js'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  businessType: null,
  password: '',
  confirmPassword: '',
  agreeTerms: false
})

const businessTypes = [
  'Event Organizer',
  'Ticketing Platform',
  'Venue',
  'Aggregator / Marketplace',
  'Other'
]

const loading = ref(false)
const errorMsg = ref('')
const formRef = ref(null)

const rules = {
  required: (v) => !!v || 'This field is required.',
  email: (v) => /.+@.+\..+/.test(v) || 'Enter a valid email address.',
  minLen: (n) => (v) => (v || '').length >= n || `Must be at least ${n} characters.`,
  matchPassword: (v) => v === form.password || 'Passwords do not match.',
  isTrue: (v) => v === true || 'You must accept the terms to continue.'
}

async function handleSubmit() {
  errorMsg.value = ''
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  try {
    const data = await authService.signup({ ...form })
    console.log(data)
    console.log(form)
    router.push({ name: 'dashboard' })
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-paper flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-lg">
      <!-- Signature: ticket-stub header -->
      <div class="relative bg-ink rounded-t-2xl px-8 pt-8 pb-6 text-paper overflow-hidden">
        <p class="font-mono text-xs tracking-widest text-gold uppercase">Quidly · Partner Access</p>
        <h1 class="font-display text-4xl font-bold tracking-tight mt-1">
          Create your partner account
        </h1>
        <p class="text-sm text-paper/60 mt-2">
          Get sandbox API keys in minutes — no card required.
        </p>
      </div>

      <!-- Perforated tear line -->
      <div class="relative h-0 bg-ink">
        <div class="absolute inset-x-0 -bottom-2 flex justify-between px-2">
          <span v-for="n in 18" :key="n" class="w-4 h-4 rounded-full bg-paper"></span>
        </div>
      </div>

      <div class="bg-white rounded-b-2xl shadow-xl px-8 pt-10 pb-8">
        <v-alert
          v-if="errorMsg"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mb-5"
          :text="errorMsg"
        />

        <v-form ref="formRef" @submit.prevent="handleSubmit">
          <v-text-field
            v-model="form.businessName"
            label="Company / platform name"
            :rules="[rules.required]"
            variant="outlined"
            density="comfortable"
            class="mb-1"
          />
          <v-text-field
            v-model="form.contactName"
            label="Contact person"
            :rules="[rules.required]"
            variant="outlined"
            density="comfortable"
            class="mb-1"
          />
          <v-text-field
            v-model="form.email"
            label="Work email"
            type="email"
            :rules="[rules.required, rules.email]"
            variant="outlined"
            density="comfortable"
            class="mb-1"
          />
          <v-text-field
            v-model="form.phone"
            label="Phone number"
            :rules="[rules.required]"
            variant="outlined"
            density="comfortable"
            class="mb-1"
          />
          <v-select
            v-model="form.businessType"
            :items="businessTypes"
            label="Business type"
            :rules="[rules.required]"
            variant="outlined"
            density="comfortable"
            class="mb-1"
          />
          <v-text-field
            v-model="form.password"
            label="Password"
            type="password"
            :rules="[rules.required, rules.minLen(8)]"
            variant="outlined"
            density="comfortable"
            class="mb-1"
          />
          <v-text-field
            v-model="form.confirmPassword"
            label="Confirm password"
            type="password"
            :rules="[rules.required, rules.matchPassword]"
            variant="outlined"
            density="comfortable"
            class="mb-1"
          />

          <v-checkbox
            v-model="form.agreeTerms"
            :rules="[rules.isTrue]"
            density="compact"
            hide-details="auto"
          >
            <template #label>
              <span class="text-sm text-gray-600"
                >I agree to Quidly's Partner Terms and API Usage Policy.</span
              >
            </template>
          </v-checkbox>

          <v-btn
            type="submit"
            block
            size="large"
            :loading="loading"
            class="!bg-ink !text-gold font-display font-semibold tracking-wide mt-6 !rounded-xl"
            elevation="0"
          >
            Create partner account
          </v-btn>
        </v-form>

        <p class="text-center text-sm text-gray-500 mt-6">
          Already have an account?
          <RouterLink to="/" class="text-ink font-semibold hover:text-gold transition-colors"
            >Log in</RouterLink
          >
        </p>
      </div>
    </div>
  </div>
</template>
