// _shared/transfers.ts
// Outbound payouts via the gateway (ASSUMPTION: Paystack Transfers). Isolated like gateway.ts.
import { HttpError } from './http.ts'

const BASE = 'https://api.paystack.co'

function key(): string {
  const k = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!k) throw new HttpError(500, 'Payment gateway is not configured')
  return k
}

async function post(path: string, body: Record<string, unknown>) {
  // a thrown TypeError here means "no response": the caller must treat the outcome as unknown
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.status === false) throw new HttpError(502, String(json?.message ?? 'The gateway rejected the request'))
  return json.data
}

export async function createTransferRecipient(p: { name: string; accountNumber: string; bankCode: string }) {
  const d = await post('/transferrecipient', {
    type: 'nuban', name: p.name, account_number: p.accountNumber, bank_code: p.bankCode, currency: 'NGN',
  })
  return String(d.recipient_code)
}

/** `reference` must be unique and stable: the gateway refuses duplicates, which makes retries safe. */
export async function initiateTransfer(p: { amount: number; recipient: string; reference: string; reason: string }) {
  const d = await post('/transfer', {
    source: 'balance', amount: Math.round(p.amount * 100), recipient: p.recipient,
    reference: p.reference, reason: p.reason, currency: 'NGN',
  })
  return { transfer_code: String(d.transfer_code), status: String(d.status) }
}
