// _shared/settle.ts
// Turns a verified Quidly Pay payment into issued tickets. Used by payment-confirm (browser)
// and quidly-pay-webhook (server), so both paths behave identically and are safe to race.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { HttpError } from './http.ts'
import { verifyPayment, toKobo } from './quidlyPay.ts'
import { queuePartnerWebhook } from './webhooks.ts' // your existing helper
import { ensureDelivery, deliverTickets, background } from './deliverTickets.ts'
import { pdfUrl } from './tickets.ts'

export type Tx = Record<string, any>
export type Settlement = { status: 'completed' | 'pending' | 'failed' | 'review'; tickets?: unknown[]; message?: string; download_url?: string }

const COLUMNS = 'id, partner_id, event_id, ticket_type_id, quantity, reference, status, amount, currency, customer_name, customer_email, customer_phone, payment_gateway_ref, metadata'

export async function loadTx(admin: SupabaseClient, by: { reference?: string | null; gatewayRef?: string | null }): Promise<Tx | null> {
  let q = admin.from('transactions').select(COLUMNS)
  if (by.reference) q = q.eq('reference', by.reference)
  else if (by.gatewayRef) q = q.eq('payment_gateway_ref', by.gatewayRef)
  else return null
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  return data
}

export async function ticketsOf(admin: SupabaseClient, txId: string) {
  const { data } = await admin.from('tickets').select('id, ticket_reference, ticket_type_id, customer_name').eq('transaction_id', txId).order('created_at')
  // same shape complete_transaction returns and the picker renders: { id, reference }
  return (data ?? []).map((t) => ({ id: t.id, reference: t.ticket_reference, ticket_type_id: t.ticket_type_id, customer_name: t.customer_name }))
}

async function flagReview(admin: SupabaseClient, tx: Tx, quidlyRef: string, reason: string) {
  console.error('PAYMENT NEEDS REVIEW', { reason, reference: tx.reference, quidlyRef })
  await admin.from('transactions').update({
    metadata: { ...(tx.metadata ?? {}), needs_review: reason, review_quidly_ref: quidlyRef, review_flagged_at: new Date().toISOString() },
  }).eq('id', tx.id)
}

const CHANNELS = ['card', 'bank_transfer', 'ussd', 'bank_pay']

export async function settle(admin: SupabaseClient, tx: Tx, quidlyRef: string): Promise<Settlement> {
  if (tx.status === 'completed') return { status: 'completed', tickets: await ticketsOf(admin, tx.id), download_url: await pdfUrl(tx.reference) }
  if (tx.payment_gateway_ref && tx.payment_gateway_ref !== quidlyRef) {
    throw new HttpError(409, 'This order is linked to a different payment')
  }

  const v = await verifyPayment(quidlyRef)

  // The payment must be for THIS order. Check before we bind anything.
  if (v.reference && v.reference !== tx.reference) throw new HttpError(409, 'This payment belongs to a different order')
  if (v.amountKobo != null && v.amountKobo !== toKobo(tx.amount)) throw new HttpError(409, 'The payment amount does not match this order')
  if (v.currency && v.currency !== tx.currency) throw new HttpError(409, 'The payment currency does not match this order')
  if (v.email && v.email.toLowerCase() !== String(tx.customer_email).toLowerCase()) throw new HttpError(409, 'This payment belongs to a different customer')

  if (v.status === 'failed') {
    // Do not fail the transaction: the customer may retry inside the same widget (new card, new transfer).
    // The unpaid hold expires on its own.
    return { status: 'failed', message: 'Your payment was not successful. You have not been charged for this order.' }
  }

  const bind = async () => {
    const patch: Record<string, unknown> = { payment_gateway_ref: quidlyRef }
    if (v.channel && CHANNELS.includes(v.channel)) patch.payment_method = v.channel
    const { error } = await admin.from('transactions').update(patch).eq('id', tx.id).or(`payment_gateway_ref.is.null,payment_gateway_ref.eq.${quidlyRef}`)
    if (error) throw error.code === '23505' ? new HttpError(409, 'This payment has already been used') : error
  }

  if (v.status === 'pending') {
    await bind() // lets polling and the webhook re-verify by reference
    return { status: 'pending', message: 'Waiting for your payment to be confirmed…' }
  }

  // ---- verified success ----
  if (v.amountKobo == null) throw new HttpError(502, 'We could not confirm the payment amount. Please try again.')
  if (tx.status !== 'pending' && tx.status !== 'processing') {
    // paid after the hold expired (typically a slow bank transfer): never issue silently
    await flagReview(admin, tx, quidlyRef, 'paid_after_expiry')
    return { status: 'review', message: 'We received your payment but your reservation had expired. Our team will sort this out and email you.' }
  }

  await bind()
  const { data: result, error } = await admin.rpc('complete_transaction', { p_reference: tx.reference, p_gateway_ref: quidlyRef })
  if (error) throw error // transient: the webhook will retry
  if (!result?.ok) {
    await flagReview(admin, tx, quidlyRef, 'complete_failed')
    return { status: 'review', message: 'We received your payment but could not issue your tickets yet. Our team will email you shortly.' }
  }

  try {
    await queuePartnerWebhook(admin, { id: tx.id, partner_id: tx.partner_id }, 'ticket.purchased', {
      reference: tx.reference, event_id: tx.event_id, ticket_type_id: tx.ticket_type_id, quantity: tx.quantity,
      amount: Number(tx.amount), currency: tx.currency,
      customer: { name: tx.customer_name, email: tx.customer_email, phone: tx.customer_phone },
      tickets: result.tickets,
    })
  } catch (e) {
    // a unique index on (transaction_id, event_type) makes the loser of a confirm/webhook race land here
    console.warn('partner webhook not queued (likely already queued)', (e as Error).message)
  }
  // issue the QR tickets + email them; recorded first so the retry job can pick it up if this worker dies
  await ensureDelivery(admin, tx.id)
  background(deliverTickets(admin, tx.id))
  return { status: 'completed', tickets: result.tickets ?? (await ticketsOf(admin, tx.id)), download_url: await pdfUrl(tx.reference) }
}

/** payment.reversed (refund/chargeback): void unused tickets and flag the order for a human. */
export async function markReversed(admin: SupabaseClient, tx: Tx) {
  await admin.from('tickets').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('transaction_id', tx.id).eq('status', 'active')
  await flagReview(admin, tx, tx.payment_gateway_ref ?? '', 'payment_reversed')
}