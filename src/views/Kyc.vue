<script setup>
import { ref, computed, onMounted } from 'vue'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import KycStatusBanner from '@/components/kyc/KycStatusBanner.vue'
import KycTypeStep from '@/components/kyc/KycTypeStep.vue'
import KycDetailsStep from '@/components/kyc/KycDetailsStep.vue'
import KycDocumentsStep from '@/components/kyc/KycDocumentsStep.vue'
import KycPayoutStep from '@/components/kyc/KycPayoutStep.vue'
import KycReviewStep from '@/components/kyc/KycReviewStep.vue'
import { kycService } from '@/services/kycService'
import { apiError } from '@/services/eventsService'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()

const STEPS = [
  { key: 'type', label: 'Account type' },
  { key: 'details', label: 'Details' },
  { key: 'documents', label: 'Documents' },
  { key: 'payout', label: 'Payout account' },
  { key: 'review', label: 'Review' },
]

const state = ref(null)
const step = ref(0)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const toast = ref({ show: false, text: '' })

const editing = computed(() => state.value?.mode === 'edit')

// jump to the first step that still needs attention
function firstIncomplete(s) {
  if (s.mode !== 'edit') return STEPS.length - 1
  const p = s.progress.steps
  if (!p.type) return 0
  if (!p.details) return 1
  if (!p.documents) return 2
  return s.payout_accounts.length ? 4 : 3
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    state.value = await kycService.get()
    step.value = firstIncomplete(state.value)
  } catch (e) {
    error.value = apiError(e, 'Could not load your verification details.')
  } finally {
    loading.value = false
  }
}
onMounted(load)

// every action returns the full state, so steps just hand it back up
const onState = (s) => { state.value = s }
const next = () => { step.value = Math.min(step.value + 1, STEPS.length - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
const back = () => { step.value = Math.max(step.value - 1, 0); window.scrollTo({ top: 0, behavior: 'smooth' }) }

// steps are reachable once the ones before them are complete
const reachable = (i) => {
  const p = state.value?.progress.steps
  if (!p || !editing.value) return false
  if (i <= 0) return true
  if (i === 1) return p.type
  if (i === 2) return p.type && p.details
  return p.type && p.details && p.documents
}

async function run(fn, message) {
  busy.value = true
  try {
    state.value = await fn()
    step.value = firstIncomplete(state.value)
    if (message) toast.value = { show: true, text: message }
    auth.fetchSession?.() // keep the cached partner (and header pill) in sync
  } catch (e) {
    toast.value = { show: true, text: apiError(e) }
  } finally {
    busy.value = false
  }
}

async function onSubmitted() {
  toast.value = { show: true, text: 'Submitted. We will review it shortly.' }
  await auth.fetchSession?.()
}
</script>

<template>
  <MainLayout class="m-4" title="Business verification" subtitle="Verify your identity to publish events and receive payouts.">
    <div v-if="loading" class="py-24 text-center"><v-progress-circular indeterminate color="#2b7fff" /></div>

    <div v-else-if="error" class="py-16 text-center">
      <p class="q-error mb-4">{{ error }}</p>
      <v-btn class="q-btn-ghost" @click="load">Try again</v-btn>
    </div>

    <div v-else-if="state" class="max-w-4xl">
      <KycStatusBanner
        :status="state.kyc_status"
        :note="state.review_note"
        :approved-at="state.kyc_approved_at"
        :can-reopen="state.can_reopen"
        :can-withdraw="state.can_withdraw"
        :busy="busy"
        @reopen="run(kycService.reopen, 'You can now edit your submission.')"
        @withdraw="run(kycService.withdraw, 'Withdrawn. You can edit and resubmit.')"
      />

      <!-- stepper (edit mode only) -->
      <div v-if="editing" class="stepper">
        <template v-for="(s, i) in STEPS" :key="s.key">
          <button type="button" class="st" :class="{ 'st--on': i <= step, 'st--cur': i === step }" :disabled="!reachable(i)" @click="step = i">
            <span class="st__dot"><i v-if="i < step" class="mdi mdi-check"></i><template v-else>{{ i + 1 }}</template></span>
            <span class="st__label">{{ s.label }}</span>
          </button>
          <span v-if="i < STEPS.length - 1" class="st__line" :class="{ 'st__line--on': i < step }"></span>
        </template>
      </div>

      <div class="panel">
        <template v-if="editing">
          <KycTypeStep v-if="step === 0" :state="state" @saved="onState" @next="next" />
          <KycDetailsStep v-else-if="step === 1" :state="state" @saved="onState" @next="next" @back="back" />
          <KycDocumentsStep v-else-if="step === 2" :state="state" @saved="onState" @next="next" @back="back" />
          <KycPayoutStep v-else-if="step === 3" :state="state" @saved="onState" @next="next" @back="back" />
          <KycReviewStep v-else :state="state" @saved="onState" @goto="step = $event" @back="back" @submitted="onSubmitted" />
        </template>

        <KycReviewStep v-else-if="state.submission" :state="state" readonly />
        <p v-else class="q-help">Nothing to show yet.</p>
      </div>

      <p class="q-help text-center mt-6">Need help? Email support@quidly.com</p>
    </div>

    <v-snackbar v-model="toast.show" timeout="3200">{{ toast.text }}</v-snackbar>
  </MainLayout>
</template>

<style scoped>
.stepper { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; overflow-x: auto; }
.st { display: inline-flex; align-items: center; gap: 8px; background: none; border: 0; cursor: pointer; white-space: nowrap; color: #9ca3af; }
.st:disabled { cursor: default; }
.st__dot { width: 26px; height: 26px; border-radius: 99px; background: #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
.st__label { font-size: 13px; font-weight: 600; }
.st--on { color: #2b7fff; }
.st--on .st__dot { background: #2b7fff; color: #fff; }
.st--cur .st__label { color: #111827; }
.st__line { flex: 1; min-width: 16px; height: 2px; background: #e5e7eb; }
.st__line--on { background: #2b7fff; }
.panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 28px; }
@media (max-width: 640px) { .panel { padding: 18px; } .st__label { display: none; } .st--cur .st__label { display: inline; } }
</style>
