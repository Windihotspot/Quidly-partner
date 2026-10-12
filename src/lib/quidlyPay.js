// Loads the Quidly Pay widget, opens it, and turns its result into a verified order status.
// The widget callback is only a hint: the server verifies the payment before issuing tickets.
import { publicEventService } from '@/services/publicEventService'

const SCRIPT_URL = 'https://securepay.quidly.ng/embedouter.js'
const CLOSE_GRACE_MS = 1500 // the widget can fire onclose just before the final callback
const POLL_EVERY_MS = 4000
const POLL_FOR_MS = 120_000

let loading = null
export function loadQuidlyPay() {
  if (window.embedQuidlyPay) return Promise.resolve()
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_URL
      s.async = true
      s.onload = resolve
      s.onerror = () => {
        loading = null
        s.remove()
        reject(new Error('Could not load the payment window. Check your connection and try again.'))
      }
      document.head.appendChild(s)
    })
  }
  return loading
}

// Resolves once: { type: 'result', res } | { type: 'closed' }
function openWidget(w) {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (v) => { if (!done) { done = true; resolve(v) } }
    loadQuidlyPay()
      .then(() =>
        window.embedQuidlyPay.initialize({
          key: w.key,
          email: w.email,
          amount: w.amount, // kobo
          currency_code: w.currency_code,
          paymentmethods: w.paymentmethods,
          reference: w.reference,
          tx_ref: w.reference,
          callback: (res) => finish({ type: 'result', res }),
          onclose: () => setTimeout(() => finish({ type: 'closed' }), CLOSE_GRACE_MS),
        })
      )
      .catch(reject)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * `created` is the paid response from widget-create-transaction ({ reference, widget, ... }).
 * Returns { status: 'completed' | 'pending' | 'failed' | 'review' | 'cancelled', tickets?, message? }
 */
export async function runCheckout(created) {
  const out = await openWidget(created.widget)
  if (out.type === 'closed' || out.res?.status === 'cancelled') return { status: 'cancelled' }

  const quidlyRef = out.res?.quidly_ref
  if (!quidlyRef) return { status: 'failed', message: out.res?.message || 'Your payment was not completed.' }

  let r = await publicEventService.confirmPayment(created.reference, quidlyRef)
  const deadline = Date.now() + POLL_FOR_MS
  while (r.status === 'pending' && Date.now() < deadline) {
    await sleep(POLL_EVERY_MS)
    r = await publicEventService.confirmPayment(created.reference)
  }
  return r.status === 'pending'
    ? { ...r, message: 'Your payment is still being confirmed. We will email your tickets as soon as it lands.' }
    : r
}