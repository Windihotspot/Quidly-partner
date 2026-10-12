// _shared/settlements.ts
// Settlement policy (from env), payouts, gateway transfer events and CSV helpers.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { createTransferRecipient, initiateTransfer } from './transfers.ts'

export type Policy = {
  fee_percent: number | null   // null = PLATFORM_FEE_PERCENT not configured
  fee_flat: number             // NGN per paid ticket
  hold_days: number            // days a sale (or the event, if release = after_event) must age before payout
  min_payout: number           // NGN; smaller balances roll over to the next run
  release: 'rolling' | 'after_event'
  payout_mode: 'manual' | 'gateway'
  require_kyc: boolean
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback
}

export function loadPolicy(): Policy {
  const pct = Deno.env.get('PLATFORM_FEE_PERCENT')
  const pctNum = Number(pct)
  return {
    fee_percent: pct !== undefined && pct !== '' && Number.isFinite(pctNum) && pctNum >= 0 && pctNum <= 100 ? pctNum : null,
    fee_flat: num(Deno.env.get('PLATFORM_FEE_FLAT'), 0),
    hold_days: Math.floor(num(Deno.env.get('SETTLEMENT_HOLD_DAYS'), 2)),
    min_payout: num(Deno.env.get('SETTLEMENT_MIN_PAYOUT'), 1000),
    release: Deno.env.get('SETTLEMENT_RELEASE') === 'after_event' ? 'after_event' : 'rolling',
    payout_mode: Deno.env.get('SETTLEMENT_PAYOUT_MODE') === 'gateway' ? 'gateway' : 'manual',
    require_kyc: Deno.env.get('SETTLEMENT_REQUIRE_KYC') !== 'false',
  }
}

/** Mirrors public.sale_fee() in SQL. */
export function feeFor(amount: number, quantity: number, percent: number, flat: number): number {
  return Math.min(amount, Math.round((amount * percent / 100 + flat * quantity) * 100) / 100)
}

export const maskAccount = (n: string) => `******${String(n).slice(-4)}`

// failure_reason holds operator instructions (gateway notes etc.): admins only
export function publicSettlement(s: Record<string, any>, forAdmin = false) {
  return {
    id: s.id, reference: s.reference, status: s.status,
    period_start: s.period_start, period_end: s.period_end,
    gross: Number(s.gross), fees: Number(s.fees), refunds: Number(s.refunds), net: Number(s.net),
    currency: s.currency, transaction_count: s.transaction_count, ticket_count: s.ticket_count,
    bank_name: s.bank_name, account_name: s.account_name, account_number: maskAccount(s.account_number),
    payout_method: s.payout_method, payout_reference: s.payout_reference,
    failure_reason: forAdmin && s.status !== 'paid' ? s.failure_reason : null,
    paid_at: s.paid_at, created_at: s.created_at,
  }
}

// ---- CSV (spreadsheet formula injection safe) --------------------------------------
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // Excel/Sheets would otherwise run it as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',')

// ---- payouts ---------------------------------------------------------------------------
/**
 * Sends a settlement through the gateway. Never touches accounts whose name was not verified
 * with the bank (e.g. mock-mode accounts). The transfer reference is the settlement reference,
 * so the gateway itself refuses to pay the same settlement twice.
 */
export async function initiatePayout(admin: SupabaseClient, s: Record<string, any>) {
  const update = (patch: Record<string, unknown>) => admin.from('settlements').update(patch).eq('id', s.id)

  const { data: acct } = await admin
    .from('partner_bank_accounts')
    .select('id, is_active, is_verified, verification_method, gateway_recipient_code, bank_code, account_number, account_name')
    .eq('id', s.bank_account_id)
    .maybeSingle()

  if (!acct || !acct.is_active || !acct.is_verified || acct.verification_method !== 'name_enquiry') {
    await update({ failure_reason: 'Payout account was not verified with the bank. Pay manually, or ask the partner to re-add it.' })
    return { ok: false, reason: 'account_not_verified' }
  }

  try {
    let recipient = acct.gateway_recipient_code as string | null
    if (!recipient) {
      recipient = await createTransferRecipient({ name: acct.account_name, accountNumber: acct.account_number, bankCode: acct.bank_code })
      await admin.from('partner_bank_accounts').update({ gateway_recipient_code: recipient }).eq('id', acct.id)
    }
    const t = await initiateTransfer({
      amount: Number(s.net), recipient, reference: String(s.reference).toLowerCase(), reason: `Quidly settlement ${s.reference}`,
    })

    if (t.status === 'otp') {
      await update({ gateway_transfer_code: t.transfer_code, failure_reason: 'The gateway is waiting for OTP approval. Turn off transfer OTP in the gateway dashboard, or approve it there.' })
      return { ok: false, reason: 'otp_required' }
    }
    const paid = t.status === 'success'
    await update({
      status: paid ? 'paid' : 'processing', payout_method: 'gateway', payout_reference: String(s.reference).toLowerCase(),
      gateway_transfer_code: t.transfer_code, failure_reason: null, paid_at: paid ? new Date().toISOString() : null,
    })
    return { ok: true, status: paid ? 'paid' : 'processing' }
  } catch (e) {
    if (e instanceof TypeError) {
      // no response from the gateway: the transfer may or may not exist. Do NOT mark failed (a retry could double-pay).
      await update({ status: 'processing', payout_method: 'gateway', failure_reason: 'No response from the gateway. Check the transfer in the gateway dashboard before retrying.' })
      return { ok: false, reason: 'unknown_outcome' }
    }
    await update({ status: 'failed', failure_reason: String((e as Error).message).slice(0, 300) })
    return { ok: false, reason: 'gateway_rejected', message: (e as Error).message }
  }
}

/** transfer.success / transfer.failed / transfer.reversed webhooks. Safe to receive twice. */
export function settlementRefFromTransfer(reference: string): string {
  return reference.toUpperCase()
}

export async function applyTransferEvent(admin: SupabaseClient, evt: { event: string; data?: Record<string, any> }) {
  const ref = String(evt.data?.reference ?? '')
  if (!ref) return { handled: false }
  const { data: s } = await admin.from('settlements').select('id, status').eq('reference', settlementRefFromTransfer(ref)).maybeSingle()
  if (!s) return { handled: false }

  if (evt.event === 'transfer.success') {
    if (s.status !== 'paid') {
      await admin.from('settlements').update({ status: 'paid', paid_at: new Date().toISOString(), failure_reason: null }).eq('id', s.id)
    }
    return { handled: true }
  }
  if (evt.event === 'transfer.failed' || evt.event === 'transfer.reversed') {
    if (s.status !== 'paid' || evt.event === 'transfer.reversed') {
      await admin.from('settlements').update({
        status: 'failed', paid_at: null,
        failure_reason: String(evt.data?.reason ?? (evt.event === 'transfer.reversed' ? 'Transfer was reversed by the gateway' : 'Transfer failed')).slice(0, 300),
      }).eq('id', s.id)
    }
    return { handled: true }
  }
  return { handled: false }
}
