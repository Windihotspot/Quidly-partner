<template>
  <div class="checkout-page">
    <div class="checkout-card">
      <!-- Header -->
      <div class="header">
        <div class="brand">
          <div class="brand-icon">Q</div>
          <span class="brand-name">Quidly</span>
        </div>
        <div class="amount-badge">{{ formattedAmount }}</div>
      </div>

      <!-- State: loading session -->
      <div v-if="loadingSession" class="state-block">
        <div class="spinner" />
        <p>Loading checkout session…</p>
      </div>

      <!-- State: invalid session -->
      <div v-else-if="!session.valid" class="state-block error">
        <p>⚠ This payment link is invalid or has expired.</p>
      </div>

     <div v-else-if="result" class="state-block result">
  <div :class="['result-icon', result.status]">
    {{ result.status === 'completed' ? '✓' : '✕' }}
  </div>

  <h3>
    {{ result.status === 'completed'
      ? 'Payment successful'
      : 'Payment failed'
    }}
  </h3>

  <p class="muted">
    Reference: {{ session.reference }}
  </p>

  <p
    v-if="result.status !== 'completed'"
    class="muted"
  >
    {{ result.reason }}
  </p>

  <div v-if="result.status === 'completed'">
    <button
      class="btn m-4 primary"
      :disabled="processing"
      @click="downloadTicket"
    >
      {{ processing ? 'Generating Ticket…' : 'Download Ticket' }}
    </button>

    <button
      v-if="session.returnUrl"
      class="btn secondary"
      :disabled="processing"
      @click="returnToMerchant"
    >
      Return to Merchant
    </button>
  </div>
</div>

      <!-- Main checkout form -->
      <div v-else>
        <div class="summary">
          <div class="row">
            <span>Merchant</span>
            <strong>{{ session.eventName }}</strong>
          </div>
          <div class="row">
            <span>Customer</span>
            <strong>{{ session.customerEmail }}</strong>
          </div>
        </div>

        <!-- Bank transfer, styled like the dummy checkout widget -->
        <div class="transfer-card">
          <!-- Amount -->
          <div class="transfer-amount">
            <p class="transfer-label">Amount to Send</p>

            <div class="transfer-copy-row">
              <p class="transfer-amount-value">{{ formattedAmount }}</p>

              <button
                type="button"
                class="copy-btn"
                :title="copiedField === 'amount' ? 'Copied!' : 'Copy amount'"
                @click="copyText(rawAmountString, 'amount')"
              >
                {{ copiedField === 'amount' ? '✓' : '📋' }}
              </button>
            </div>
          </div>

          <!-- Bank name -->
          <div class="transfer-row-block">
            <p class="transfer-sublabel">Bank Name</p>
            <p class="transfer-bank-name">Opay</p>
          </div>

          <!-- Account number -->
          <div class="transfer-row-block bordered">
            <p class="transfer-sublabel">Account Number</p>

            <div class="transfer-copy-row">
              <p class="transfer-account-number">9132378328</p>

              <button
                type="button"
                class="copy-btn"
                :title="copiedField === 'account' ? 'Copied!' : 'Copy account number'"
                @click="copyText('9132378328', 'account')"
              >
                  <i :class="copiedField === 'account' ? 'fas fa-check' : 'fas fa-copy'"></i>
              </button>
            </div>

            <p class="transfer-account-alias">Ifiok Usanga</p>
          </div>

          <!-- Reference -->
          <div class="transfer-row-block">
            <p class="transfer-sublabel">Reference</p>

            <div class="transfer-copy-row">
              <p class="transfer-reference">{{ session.reference }}</p>

              <button
  type="button"
  class="copy-btn"
  :title="copiedField === 'reference' ? 'Copied!' : 'Copy reference'"
  @click="copyText(session.reference, 'reference')"
>
  <i :class="copiedField === 'reference' ? 'fas fa-check' : 'fas fa-copy'"></i>
</button>
            </div>
          </div>

          <!-- Expiry -->
          <div class="transfer-expiry">
            <p>
              This session expires in
              <span class="transfer-expiry-time">{{ formattedTime }}</span>.
              Make your transfer before it expires.
            </p>
          </div>

          <p class="muted small hint">
            In test mode, click the button below to simulate payment verification.
          </p>

          <div v-if="bankError" class="form-error">{{ bankError }}</div>

          <!-- Confirmation -->
          <button
            type="button"
            class="transfer-confirm-btn m-4"
            :disabled="processing"
            @click="submitBankTransfer(true)"
          >
            {{ processing ? 'Verifying…' : `I'VE SENT THE MONEY (${formattedAmount})` }}
          </button>
        </div>
      </div>

      <div class="footer">
        <span>🔒 TLS secured · Test environment</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

// ========================================================================
// Config
// ========================================================================

const PAYMENT_VERIFY_ENDPOINT =
  import.meta.env.VITE_PAYMENT_VERIFY_URL ||
  'https://syaxbgcwixomicckmfwq.supabase.co/functions/v1/payment-verify'

const GET_TICKET_ENDPOINT =
  import.meta.env.VITE_GET_TICKET_URL ||
  'https://syaxbgcwixomicckmfwq.supabase.co/functions/v1/download-ticket'

// ========================================================================
// Session
// ========================================================================

const session = reactive({
  valid: false,
  sessionId: '',
  transactionId: '',
  reference: '',
  amount: 0,
  currency: 'NGN',
  eventName: '',
  customerEmail: '',
  returnUrl: '',
})

// ========================================================================
// UI State
// ========================================================================

const loadingSession = ref(true)
const processing = ref(false)
const bankError = ref('')
const result = ref(null)
// { status: 'completed' | 'failed', reason }

const copiedField = ref('')

// ========================================================================
// Expiry Countdown
// ========================================================================

const EXPIRY_MINUTES = 30

const expiresAt = ref(0)
const now = ref(Date.now())

let timerHandle = null
let copyTimerHandle = null

// ========================================================================
// Computed
// ========================================================================

const formattedAmount = computed(() => {
  const amount = Number(session.amount || 0)

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: session.currency || 'NGN',
    minimumFractionDigits: 2,
  }).format(amount)
})

const rawAmountString = computed(() => {
  return String(Number(session.amount || 0))
})

const formattedTime = computed(() => {
  const msLeft = Math.max(0, expiresAt.value - now.value)

  const totalSeconds = Math.floor(msLeft / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

// ========================================================================
// Timer
// ========================================================================

function startTransferTimer() {
  expiresAt.value =
    Date.now() + EXPIRY_MINUTES * 60 * 1000

  if (timerHandle) {
    clearInterval(timerHandle)
  }

  timerHandle = setInterval(() => {
    now.value = Date.now()

    // Stop timer once expired
    if (now.value >= expiresAt.value) {
      clearInterval(timerHandle)
      timerHandle = null
    }
  }, 1000)
}

// ========================================================================
// Load Checkout Session
// ========================================================================

function loadSession() {
  const params = new URLSearchParams(window.location.search)

  const sessionId =
    params.get('session_id') ||
    params.get('session')

  const reference = params.get('reference')

  if (!sessionId || !reference) {
    session.valid = false
    loadingSession.value = false
    return
  }

  session.sessionId = sessionId
  session.reference = reference

  session.amount = Number(
    params.get('amount') || 0
  )

  session.currency =
    params.get('currency') || 'NGN'

  session.eventName =
    params.get('event_name') || 'Test Event'

  session.customerEmail =
    params.get('email') ||
    params.get('customer_email') ||
    ''

  session.returnUrl =
    params.get('return_url') || ''

  session.valid = true
  loadingSession.value = false

  startTransferTimer()
}

// ========================================================================
// Copy to Clipboard
// ========================================================================

async function copyText(value, field) {
  try {
    await navigator.clipboard.writeText(
      String(value)
    )

    copiedField.value = field

    if (copyTimerHandle) {
      clearTimeout(copyTimerHandle)
    }

    copyTimerHandle = setTimeout(() => {
      if (copiedField.value === field) {
        copiedField.value = ''
      }
    }, 1500)

  } catch (error) {
    console.error('Copy failed:', error)
  }
}

// ========================================================================
// Verify Bank Transfer
// ========================================================================

async function submitBankTransfer(success = true) {
  if (processing.value) {
    return
  }

  // Prevent verification after expiry
  if (Date.now() >= expiresAt.value) {
    bankError.value =
      'This payment session has expired. Please start a new payment.'

    return
  }

  processing.value = true
  bankError.value = ''

  try {
    console.log(
      'Verifying bank transfer payment...'
    )

    console.log(
      'Endpoint:',
      PAYMENT_VERIFY_ENDPOINT
    )

    console.log(
      'Session ID:',
      session.sessionId
    )

    const response = await fetch(
      PAYMENT_VERIFY_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: session.sessionId,
          outcome: success
            ? 'success'
            : 'failed',
          payment_method: 'bank_transfer',
        }),
      }
    )

    const data = await response.json()

    console.log(
      'Payment verification response:',
      data
    )

    // --------------------------------------------------------------
    // HTTP error
    // --------------------------------------------------------------

    if (!response.ok) {
      console.error(
        'Payment verification failed:',
        data
      )

      bankError.value =
        data.error ||
        'Payment verification failed.'

      processing.value = false
      return
    }

    // --------------------------------------------------------------
    // API-level error
    // --------------------------------------------------------------

    if (!data.success) {
      bankError.value =
        data.error ||
        'Payment verification failed.'

      processing.value = false
      return
    }

    // --------------------------------------------------------------
    // Extract verification result
    // --------------------------------------------------------------

    const paymentData = data.data

    if (!paymentData) {
      bankError.value =
        'Invalid payment verification response.'

      processing.value = false
      return
    }

    // --------------------------------------------------------------
    // IMPORTANT:
    // Save transaction ID returned by payment-verify.
    //
    // The ticket endpoint accepts transaction_id.
    // --------------------------------------------------------------

    session.transactionId =
      paymentData.transaction_id || ''

    // --------------------------------------------------------------
    // Finish payment
    // --------------------------------------------------------------

    await finishPayment(
      paymentData.outcome === 'success'
        ? 'success'
        : 'failed',
      paymentData.failed_reason || null
    )

  } catch (error) {
    console.error(
      'Payment verification error:',
      error
    )

    bankError.value =
      error instanceof Error
        ? error.message
        : 'Failed to verify payment. Please try again.'

    processing.value = false
  }
}

// ========================================================================
// Finish Payment
// ========================================================================

async function finishPayment(
  outcome,
  reason = null
) {
  const status =
    outcome === 'success'
      ? 'completed'
      : 'failed'

  if (timerHandle) {
    clearInterval(timerHandle)
    timerHandle = null
  }

  processing.value = false

  result.value = {
    status,
    reason,
  }
}

// ========================================================================
// Download Ticket
// ========================================================================

async function downloadTicket() {
  if (processing.value) {
    return
  }

  if (!session.transactionId) {
    bankError.value =
      'Transaction ID is missing. Unable to download ticket.'

    return
  }

  processing.value = true
  bankError.value = ''

  try {
    console.log(
      'Downloading ticket...',
      session.transactionId
    )

    const response = await fetch(
      GET_TICKET_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id:
            session.transactionId,
        }),
      }
    )

    // --------------------------------------------------------------
    // Handle failed response
    // --------------------------------------------------------------

    if (!response.ok) {
      let errorMessage =
        'Failed to generate ticket.'

      try {
        const errorData =
          await response.json()

        errorMessage =
          errorData.error ||
          errorMessage

      } catch {
        // Response was not JSON
      }

      throw new Error(errorMessage)
    }

    // --------------------------------------------------------------
    // Make sure we received a PDF
    // --------------------------------------------------------------

    const contentType =
      response.headers.get(
        'Content-Type'
      ) || ''

    if (
      !contentType.includes(
        'application/pdf'
      )
    ) {
      let errorMessage =
        'The ticket service did not return a PDF.'

      try {
        const errorData =
          await response.json()

        errorMessage =
          errorData.error ||
          errorMessage
      } catch {
        // Ignore parsing error
      }

      throw new Error(errorMessage)
    }

    // --------------------------------------------------------------
    // Convert response to Blob
    // --------------------------------------------------------------

    const blob =
      await response.blob()

    // --------------------------------------------------------------
    // Trigger browser download
    // --------------------------------------------------------------

    const downloadUrl =
      window.URL.createObjectURL(blob)

    const link =
      document.createElement('a')

    link.href = downloadUrl

    link.download =
      `${session.reference || 'ticket'}.pdf`

    document.body.appendChild(link)

    link.click()

    document.body.removeChild(link)

    // --------------------------------------------------------------
    // Cleanup
    // --------------------------------------------------------------

    window.URL.revokeObjectURL(
      downloadUrl
    )

  } catch (error) {
    console.error(
      'Ticket download error:',
      error
    )

    bankError.value =
      error instanceof Error
        ? error.message
        : 'Failed to download ticket.'

  } finally {
    processing.value = false
  }
}

// ========================================================================
// Return to Merchant
// ========================================================================

function returnToMerchant() {
  if (!session.returnUrl) {
    return
  }

  try {
    const url =
      new URL(session.returnUrl)

    url.searchParams.set(
      'reference',
      session.reference
    )

    url.searchParams.set(
      'status',
      result.value?.status || ''
    )

    if (session.transactionId) {
      url.searchParams.set(
        'transaction_id',
        session.transactionId
      )
    }

    window.location.href =
      url.toString()

  } catch (error) {
    console.error(
      'Invalid return URL:',
      error
    )
  }
}

// ========================================================================
// Lifecycle
// ========================================================================

onMounted(() => {
  loadSession()
})

onUnmounted(() => {
  if (timerHandle) {
    clearInterval(timerHandle)
    timerHandle = null
  }

  if (copyTimerHandle) {
    clearTimeout(copyTimerHandle)
    copyTimerHandle = null
  }
})
</script>

<style scoped>
.checkout-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f6fb;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.checkout-card {
  width: 100%;
  max-width: 500px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(20, 30, 60, 0.08);
  padding: 28px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #2f6bff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.brand-name {
  font-weight: 600;
  font-size: 16px;
}

.amount-badge {
  background: #eef2ff;
  color: #2f4bff;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.summary {
  background: #f8f9fc;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 3px 0;
  color: #555;
}

.row strong {
  color: #1a1a2e;
  font-weight: 600;
}

/* ---- Bank transfer card, styled after the dummy checkout ---- */
.transfer-card {
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #d7e3e7;
}

.transfer-amount {
  background: #e8f2f4;
  padding: 22px 20px;
  text-align: center;
}

.transfer-label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  margin: 0;
}

.transfer-copy-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}

.transfer-amount-value {
  font-size: 18px;
  font-weight: 700;
  color: #334155;
  margin: 0;
}

.copy-btn {
  border: none;
  background: transparent;
  color: #4d7c85;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 2px;
}

.copy-btn:hover {
  color: #2f5963;
}

.transfer-row-block {
  background: #fff;
  padding: 18px 20px;
  text-align: center;
}

.transfer-row-block.bordered {
  border-top: 1px solid #f1f5f7;
}

.transfer-sublabel {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin: 0;
}

.transfer-bank-name {
  margin-top: 10px;
  font-size: 14px;
  font-weight: 700;
  color: #315460;
}

.transfer-account-number {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #263d46;
}

.transfer-account-alias {
  margin-top: 6px;
  font-size: 13px;
  color: #6b7280;
}

.transfer-reference {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #263d46;
}

.transfer-expiry {
  background: #f8fafb;
  padding: 16px;
  text-align: center;
}

.transfer-expiry p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #4b5563;
}

.transfer-expiry-time {
  font-weight: 700;
  color: #315460;
}

.hint {
  text-align: center;
  padding: 12px 4px 0;
}

.transfer-confirm-btn {
  width: 90%;
  margin-top: 4px;
  border: none;
  background: linear-gradient(to right, #22c55e, #7e22ce, #0891b2);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 16px;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.transfer-confirm-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.transfer-confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn {
  border: none;
  border-radius: 10px;
  padding: 13px 16px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn.primary {
  background: #2f6bff;
  color: #fff;
}

.btn.primary:hover:not(:disabled) {
  background: #1e4cc4;
  box-shadow: 0 4px 12px rgba(47, 107, 255, 0.3);
}

.muted {
  color: #888;
  font-size: 13px;
}

.muted.small {
  font-size: 12px;
}

.form-error {
  color: #d33;
  font-size: 13px;
  background: #fef0f0;
  padding: 8px 10px;
  border-radius: 6px;
  border-left: 3px solid #d33;
  margin: 12px 0 0;
}

.state-block {
  text-align: center;
  padding: 30px 10px;
}

.state-block.error {
  color: #d33;
}

.result-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  margin: 0 auto 12px;
  color: #fff;
}

.result-icon.completed {
  background: #22c55e;
}

.result-icon.failed {
  background: #ef4444;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e0e4ee;
  border-top-color: #2f6bff;
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.footer {
  margin-top: 20px;
  text-align: center;
  font-size: 11px;
  color: #aaa;
}
</style>