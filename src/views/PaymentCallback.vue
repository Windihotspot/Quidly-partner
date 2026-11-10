<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { verifyPayment } from '@/lib/paystack'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const success = ref(false)
const error = ref('')

const reference =
  route.query.reference ||
  route.query.trxref ||
  sessionStorage.getItem('paystack_pending_reference')

onMounted(async () => {
  if (!reference) {
    error.value = 'No payment reference was found.'
    loading.value = false
    return
  }

  try {
    const result = await verifyPayment(reference)

    if (result.success) {
      success.value = true

      sessionStorage.removeItem('paystack_pending_reference')
    } else {
      error.value =
        result.message || 'Your payment could not be confirmed.'
    }

  } catch (err) {
    console.error('[Payment Callback]', err)

    error.value =
      err.message || 'Unable to verify your payment.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 px-5">
    <div class="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">

      <div v-if="loading">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600 mx-auto mb-5"></div>

        <h2 class="text-xl font-bold text-slate-800">
          Verifying your payment
        </h2>

        <p class="text-slate-500 mt-2">
          Please wait while we confirm your transaction.
        </p>
      </div>

      <div v-else-if="success">
        <div class="text-5xl text-green-500 mb-4">
          ✓
        </div>

        <h2 class="text-2xl font-bold text-slate-800">
          Payment successful!
        </h2>

        <p class="text-slate-500 mt-3">
          Your payment has been confirmed. Your tickets will be sent to your email.
        </p>

        <p class="text-xs text-slate-400 mt-4 break-all">
          Reference: {{ reference }}
        </p>

        <button
          @click="router.push('/')"
          class="mt-7 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
        >
          Back to events
        </button>
      </div>

      <div v-else>
        <div class="text-5xl text-red-500 mb-4">!</div>

        <h2 class="text-xl font-bold text-slate-800">
          Payment confirmation pending
        </h2>

        <p class="text-slate-500 mt-3">
          {{ error }}
        </p>

        <p class="text-sm text-slate-500 mt-3">
          If you have already paid, please do not pay again. Contact support with your payment reference.
        </p>
      </div>

    </div>
  </div>
</template>
