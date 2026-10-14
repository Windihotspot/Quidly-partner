// _shared/deliverTickets.ts
// After a payment is verified: make sure every ticket carries a signed QR token, build the per-order PDF,
// store it, email the customer. Safe to call repeatedly and from several places at once: an atomic claim on
// ticket_deliveries ensures only one worker sends. Failures are recorded and retried by ticket-delivery-retry.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { qrToken, pdfUrl } from './tickets.ts'
import { buildTicketPdf } from './ticketPdf.ts'
import { sendTicketEmail } from './ticketEmail.ts'

const BUCKET = 'ticket-pdfs'

export type Order = {
  tx: Record<string, any>
  event: Record<string, any>
  organizer: string
  tickets: Array<{ id: string; reference: string; token: string; holder: string; typeName: string; groupSize: number | null; qrData: string | null }>
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined
/** Run after the HTTP response is sent (Supabase Edge); falls back to fire-and-forget locally. */
export function background(p: Promise<unknown>) {
  const safe = p.catch((e) => console.error('background task failed', e))
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(safe)
}

export async function ensureDelivery(admin: SupabaseClient, txId: string) {
  const { error } = await admin.from('ticket_deliveries').upsert({ transaction_id: txId }, { onConflict: 'transaction_id', ignoreDuplicates: true })
  if (error) throw error
}

export async function loadOrder(admin: SupabaseClient, txId: string): Promise<Order> {
  const { data: tx, error } = await admin.from('transactions')
    .select('id, reference, status, partner_id, event_id, customer_name, customer_email').eq('id', txId).single()
  if (error) throw error
  if (tx.status !== 'completed') throw new Error('Transaction is not completed')
  const [ev, partner, rows] = await Promise.all([
    admin.from('events').select('id, event_name, starts_at, ends_at, timezone, venue_name, address, country, format, banner_url, theme').eq('id', tx.event_id).single(),
    admin.from('partners').select('business_name').eq('id', tx.partner_id).single(),
    admin.from('tickets').select('id, ticket_reference, qr_code_data, customer_name, ticket_types(name, group_size)').eq('transaction_id', txId).order('created_at'),
  ])
  if (ev.error) throw ev.error
  if (rows.error) throw rows.error
  if (!rows.data?.length) throw new Error('No tickets found for this transaction')

  const tickets = await Promise.all(rows.data.map(async (r: any) => ({
    id: r.id,
    reference: r.ticket_reference,
    token: await qrToken(r.ticket_reference),
    qrData: r.qr_code_data as string | null,
    holder: r.customer_name || tx.customer_name,
    typeName: r.ticket_types?.name ?? 'Ticket',
    groupSize: r.ticket_types?.group_size ?? null,
  })))
  return { tx, event: ev.data, organizer: partner.data?.business_name ?? '', tickets }
}

/** Overwrite qr_code_data with the signed token, so the scanner can reject forged codes before touching the DB. */
async function ensureTokens(admin: SupabaseClient, order: Order) {
  await Promise.all(order.tickets.filter((t) => t.qrData !== t.token).map(async (t) => {
    const { error } = await admin.from('tickets').update({ qr_code_data: t.token }).eq('id', t.id)
    if (error) throw error
  }))
}

/** Build + store the order PDF (idempotent). Also used lazily by ticket-files if a customer clicks before it exists. */
export async function ensurePdf(admin: SupabaseClient, order: Order, force = false): Promise<string> {
  const path = `${order.tx.partner_id}/${order.event.id}/${order.tx.reference}.pdf`
  if (!force) {
    const { data } = await admin.from('ticket_deliveries').select('pdf_path').eq('transaction_id', order.tx.id).maybeSingle()
    if (data?.pdf_path) return data.pdf_path
  }
  await ensureTokens(admin, order)
  const bytes = await buildTicketPdf({
    event: order.event, organizer: order.organizer, orderRef: order.tx.reference,
    tickets: order.tickets.map((t) => ({ reference: t.reference, token: t.token, holder: t.holder, typeName: t.typeName, groupSize: t.groupSize })),
  })
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  await admin.from('ticket_deliveries').update({ pdf_path: path }).eq('transaction_id', order.tx.id)
  return path
}

export async function signedPdfUrl(admin: SupabaseClient, path: string, seconds = 60) {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, seconds, { download: 'tickets.pdf' })
  if (error || !data) throw error ?? new Error('Could not sign the PDF link')
  return data.signedUrl
}

export async function deliverTickets(admin: SupabaseClient, txId: string, opts: { force?: boolean } = {}): Promise<'sent' | 'skipped' | 'failed'> {
  await ensureDelivery(admin, txId)
  const now = new Date().toISOString()
  const stale = new Date(Date.now() - 5 * 60_000).toISOString()
  const claimable = opts.force ? 'status.in.(pending,failed,sent)' : 'status.in.(pending,failed)'

  const { data: claimed, error: ce } = await admin.from('ticket_deliveries')
    .update({ status: 'sending', last_attempt_at: now })
    .eq('transaction_id', txId)
    .or(`${claimable},and(status.eq.sending,last_attempt_at.lt.${stale})`)
    .select('attempts, resend_count').maybeSingle()
  if (ce) throw ce
  if (!claimed) return 'skipped' // someone else is sending, or it is already sent

  try {
    const order = await loadOrder(admin, txId)
    const path = await ensurePdf(admin, order, !!opts.force)
    const messageId = await sendTicketEmail(order, await pdfUrl(order.tx.reference))
    await admin.from('ticket_deliveries').update({
      status: 'sent', attempts: claimed.attempts + 1, last_error: null, sent_at: new Date().toISOString(),
      provider_message_id: messageId, pdf_path: path, resend_count: claimed.resend_count + (opts.force ? 1 : 0),
    }).eq('transaction_id', txId)
    return 'sent'
  } catch (e) {
    console.error('ticket delivery failed', txId, e)
    await admin.from('ticket_deliveries').update({
      status: 'failed', attempts: claimed.attempts + 1, last_error: String((e as Error).message ?? e).slice(0, 500),
    }).eq('transaction_id', txId)
    return 'failed'
  }
}