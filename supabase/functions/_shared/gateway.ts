// _shared/gateway.ts
// All payment-gateway calls live here so swapping providers touches one file.
// ASSUMPTION: Paystack. Needs PAYSTACK_SECRET_KEY.
import { HttpError } from './http.ts'

const BASE = 'https://api.paystack.co'

function secret(): string {
  const k = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!k) throw new HttpError(500, 'Payment gateway is not configured')
  return k
}

async function ps(path: string, init: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const json = await res.json().catch(() => null)
  return { ok: res.ok && json?.status !== false, status: res.status, json }
}

export type Bank = { name: string; code: string }

let bankCache: { at: number; banks: Bank[] } | null = null
const SIX_HOURS = 6 * 60 * 60 * 1000

export async function listBanks(): Promise<Bank[]> {
  if (bankCache && Date.now() - bankCache.at < SIX_HOURS) return bankCache.banks

  const banks: Bank[] = []
  let next: string | null = null
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ country: 'nigeria', perPage: '100', use_cursor: 'true' })
    if (next) qs.set('next', next)
    const r = await ps(`/bank?${qs}`)
    if (!r.ok) throw new HttpError(502, 'Could not load bank list')
    for (const b of r.json.data ?? []) {
      if (b.active && !b.is_deleted && (b.currency ?? 'NGN') === 'NGN') {
        banks.push({ name: b.name, code: String(b.code) })
      }
    }
    next = r.json.meta?.next ?? null
    if (!next) break
  }
  banks.sort((a, b) => a.name.localeCompare(b.name))
  bankCache = { at: Date.now(), banks }
  return banks
}

export async function resolveAccount(bankCode: string, accountNumber: string) {
  const qs = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode })
  const r = await ps(`/bank/resolve?${qs}`)
  if (!r.ok || !r.json?.data?.account_name) {
    throw new HttpError(422, 'Could not verify this account. Check the bank and account number.')
  }
  return { account_name: String(r.json.data.account_name), account_number: accountNumber }
}

export async function initializeTransaction(p: {
  email: string
  amount: number // NGN, converted to kobo here
  reference: string
  channel: 'card' | 'bank_transfer' | 'ussd'
  callbackUrl?: string
  metadata?: Record<string, unknown>
}) {
  const r = await ps('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: p.email,
      amount: Math.round(p.amount * 100),
      currency: 'NGN',
      reference: p.reference,
      channels: [p.channel],
      callback_url: p.callbackUrl,
      metadata: p.metadata,
    }),
  })
  if (!r.ok) {
    console.error('gateway init failed', r.status, r.json)
    throw new HttpError(502, 'Could not start payment')
  }
  return {
    authorization_url: r.json.data.authorization_url as string,
    access_code: r.json.data.access_code as string,
  }
}

export async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  if (!signature) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}
