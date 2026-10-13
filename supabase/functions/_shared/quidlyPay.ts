// _shared/quidlyPay.ts
// All Quidly Pay (securepay.quidly.ng) calls live here so provider specifics touch one file.
//
// CONFIRMED (Quidly Pay dashboard): webhook = POST { event_type, data: { quidly_ref, ... } }, event_type is one of
//   payment.success | payment.failed | payment.expired | payment.reversed
//   header X-Quidly-Signature = HMAC-SHA512(exact raw body, webhook secret), uppercase hex.
// ASSUMPTIONS: the Verification API is not in the docs I have. Everything marked ASSUMPTION below must be checked:
//   - verify endpoint:  GET {QUIDLY_PAY_API_BASE}{QUIDLY_PAY_VERIFY_PATH}  (Bearer QUIDLY_PAY_SECRET_KEY)
//   - amounts are in kobo (the widget's `amount` is, per the sample page)
//   - our reference is accepted by the widget as `reference`/`tx_ref` and echoed back
// Env: QUIDLY_PAY_PUBLIC_KEY, QUIDLY_PAY_SECRET_KEY, QUIDLY_PAY_WEBHOOK_SECRET, QUIDLY_PAY_API_BASE, QUIDLY_PAY_VERIFY_PATH, QUIDLY_PAY_METHODS
import { HttpError } from './http.ts'

const env = (k: string, d = '') => Deno.env.get(k) ?? d

export const toKobo = (naira: number | string) => Math.round(Number(naira) * 100)

/** Params the frontend passes straight to window.embedQuidlyPay.initialize() */
export function widgetParams(p: { reference: string; email: string; amountNaira: number }) {
  const key = env('QUIDLY_PAY_PUBLIC_KEY')
  if (!key) throw new HttpError(500, 'Payments are not configured')
  return {
    key,
    email: p.email,
    amount: toKobo(p.amountNaira),
    currency_code: 'NGN',
    paymentmethods: env('QUIDLY_PAY_METHODS', 'card,bank_transfer').split(',').map((s) => s.trim()).filter(Boolean),
    reference: p.reference, // ASSUMPTION: embedOuter.js reads options.reference / options.tx_ref
    tx_ref: p.reference,
  }
}

export type Verified = {
  status: 'success' | 'pending' | 'failed'
  amountKobo: number | null
  currency: string | null
  reference: string | null
  email: string | null
  channel: string | null
}

const OK = ['success', 'successful', 'completed', 'paid']
const BAD = ['failed', 'declined', 'cancelled', 'canceled', 'abandoned', 'expired', 'reversed']

/** Source of truth for a payment. Never trust the widget callback or the webhook body on their own. */
export async function verifyPayment(quidlyRef: string): Promise<Verified> {
  const secret = env('QUIDLY_PAY_SECRET_KEY')
  if (!secret) throw new HttpError(500, 'Payments are not configured')
  const url = env('QUIDLY_PAY_API_BASE', 'https://paymentapi.quidly.ng') +
    env('QUIDLY_PAY_VERIFY_PATH', '/verify/{ref}').replace('{ref}', encodeURIComponent(quidlyRef)) // ASSUMPTION
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10000) }).catch(() => null)
  if (!res) throw new HttpError(502, 'We could not reach the payment provider. Please try again.')
  if (res.status === 404) throw new HttpError(404, 'We could not find that payment')
  const json = await res.json().catch(() => null)
  if (!res.ok || !json) {
    console.error('quidly pay verify failed', res.status, json)
    throw new HttpError(502, 'We could not confirm your payment yet. Please try again.')
  }
  const d = json.data ?? json // ASSUMPTION: response field names
  const s = String(d.status ?? '').toLowerCase()
  return {
    status: OK.includes(s) ? 'success' : BAD.includes(s) ? 'failed' : 'pending',
    amountKobo: d.amount != null ? Number(d.amount) : null,
    currency: d.currency ?? d.currency_code ?? null,
    reference: d.tx_ref ?? d.reference ?? null,
    email: d.email ?? d.customer?.email ?? null,
    channel: d.channel ?? d.payment_method ?? null,
  }
}

export type CallbackEvent = 'payment.success' | 'payment.failed' | 'payment.expired' | 'payment.reversed'

export function parseCallback(payload: Record<string, any>) {
  const d = payload?.data && typeof payload.data === 'object' ? payload.data : {}
  const ref = d.tx_ref ?? d.reference // ASSUMPTION: only present if the widget echoes our reference
  return {
    eventType: String(payload?.event_type ?? ''),
    quidlyRef: d.quidly_ref ? String(d.quidly_ref) : null,
    reference: ref ? String(ref) : null,
  }
}

const enc = new TextEncoder()
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** HMAC-SHA512 over the exact raw request bytes, uppercase hex, constant-time compare. */
export async function verifyWebhookSignature(rawBody: Uint8Array, header: string | null): Promise<boolean> {
  const secret = env('QUIDLY_PAY_WEBHOOK_SECRET')
  if (!secret) throw new HttpError(500, 'Webhook secret is not configured')
  if (!header) return false
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, rawBody)).toUpperCase()
  const given = header.trim().toUpperCase()
  if (given.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}