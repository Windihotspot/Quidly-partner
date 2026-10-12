<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
  note: { type: String, default: null },
  approvedAt: { type: String, default: null },
  canReopen: { type: Boolean, default: false },
  canWithdraw: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['reopen', 'withdraw'])

const CONFIG = {
  not_started: { icon: 'mdi-shield-outline', bg: '#eaf2ff', color: '#1d5fd1', title: 'Verify your account', text: 'Complete verification to publish events and receive payouts.' },
  submitted: { icon: 'mdi-clock-outline', bg: '#eaf2ff', color: '#1d5fd1', title: 'Submitted for review', text: 'We usually review within 24 to 48 hours.' },
  under_review: { icon: 'mdi-magnify', bg: '#eaf2ff', color: '#1d5fd1', title: 'Under review', text: "Our team is checking your details. We'll email you when it's done." },
  resubmission_required: { icon: 'mdi-alert-circle-outline', bg: '#fff3e0', color: '#b45309', title: 'More information needed', text: 'Please update your details and resubmit.' },
  approved: { icon: 'mdi-check-decagram', bg: '#e8f5e9', color: '#1b8a3a', title: 'Verified', text: '' },
  rejected: { icon: 'mdi-close-circle-outline', bg: '#fee2e2', color: '#b91c1c', title: 'Verification unsuccessful', text: 'You can fix the issues below and submit again.' },
  suspended: { icon: 'mdi-lock-outline', bg: '#fee2e2', color: '#b91c1c', title: 'Account suspended', text: 'Contact support@quidly.com for help.' },
}
const cfg = computed(() => CONFIG[props.status] ?? CONFIG.not_started)
const approvedText = computed(() =>
  props.approvedAt ? `Verified on ${new Date(props.approvedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'Your account is verified.',
)
</script>

<template>
  <div class="banner" :style="{ background: cfg.bg, color: cfg.color }">
    <i class="mdi banner__icon" :class="cfg.icon"></i>
    <div class="flex-1">
      <p class="banner__title">{{ cfg.title }}</p>
      <p class="banner__text">{{ status === 'approved' ? approvedText : cfg.text }}</p>
      <p v-if="note" class="banner__note"><strong>Reviewer's note:</strong> {{ note }}</p>
    </div>
    <v-btn v-if="canReopen" class="q-btn-primary" :loading="busy" @click="emit('reopen')">Update details</v-btn>
    <v-btn v-if="canWithdraw" variant="outlined" class="!normal-case" :loading="busy" @click="emit('withdraw')">Withdraw to edit</v-btn>
  </div>
</template>

<style scoped>
.banner { display: flex; align-items: center; gap: 14px; border-radius: 14px; padding: 16px 20px; margin-bottom: 24px; flex-wrap: wrap; }
.banner__icon { font-size: 28px; }
.banner__title { font-weight: 700; }
.banner__text { font-size: 14px; opacity: .9; }
.banner__note { font-size: 14px; margin-top: 6px; color: #1f2937; }
</style>
