// payment-webhook: gateway -> Quidly. Verifies signature + amount, then issues tickets (idempotent).
// Deploy with --no-verify-jwt and set this URL as the webhook in your gateway dashboard.
import { handle, reply, requireMethod, HttpError } from '../_shared/http.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { verifySignature } from '../_shared/gateway.ts'
import { queuePartnerWebhook } from '../_shared/webhooks.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')

  const raw = await req.text()
  if (!(await verifySignature(raw, req.headers.get('x-paystack-signature') ?? ''))) {
    throw new HttpError(401, 'Invalid signature')
  }

  let evt: any
  try { evt = JSON.parse(raw) } catch { throw new HttpError(400, 'Invalid JSON') }
  if (evt.event !== 'charge.success') return reply(cors, { received: true })

  const d = evt.data ?? {}
  const reference = String(d.reference ?? '')
  const admin = getAdminClient()

  const { data: tx } = await admin
    .from('transactions')
    .select('id, partner_id, event_id, ticket_type_id, quantity, amount, currency, status, customer_name, customer_email, customer_phone')
    .eq('reference', reference)
    .maybeSingle()

  // Always 200 for things we can't act on, otherwise the gateway retries forever.
  if (!tx) { console.error('payment-webhook: unknown reference', reference); return reply(cors, { received: true }) }
  if (tx.status === 'completed') return reply(cors, { received: true })

  const expectedKobo = Math.round(Number(tx.amount) * 100)
  if (Number(d.amount) !== expectedKobo || String(d.currency ?? 'NGN').toUpperCase() !== (tx.currency ?? 'NGN')) {
    console.error('payment-webhook: AMOUNT MISMATCH', { reference, expectedKobo, got: d.amount })
    await admin.rpc('fail_transaction', { p_reference: reference, p_reason: 'amount_mismatch' }) // needs manual review
    return reply(cors, { received: true })
  }

  const { data: result, error } = await admin.rpc('complete_transaction', {
    p_reference: reference,
    p_gateway_ref: String(d.id ?? d.reference),
  })
  if (error) throw error // 500 -> gateway retries, and the RPC is idempotent

  if (!result?.ok) {
    // e.g. paid after the hold expired and tickets sold out -> refund manually
    console.error('payment-webhook: could not complete', reference, result)
    return reply(cors, { received: true })
  }

  await queuePartnerWebhook(admin, tx, 'ticket.purchased', {
    reference, event_id: tx.event_id, ticket_type_id: tx.ticket_type_id, quantity: tx.quantity,
    amount: tx.amount, currency: tx.currency,
    customer: { name: tx.customer_name, email: tx.customer_email, phone: tx.customer_phone },
    tickets: result.tickets,
  })
  return reply(cors, { received: true })
}, { widget: true }))
