// payment-confirm: called by the checkout page after the Quidly Pay widget responds, and while polling.
// POST { reference, quidly_ref? }  ->  { reference, status: completed|pending|failed|review, tickets?, message? }
// The widget result is only a hint: the payment is verified server-side before any ticket is issued.
// Deploy with --no-verify-jwt.
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { loadTx, settle, ticketsOf } from '../_shared/settle.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const admin = getAdminClient()
  const body = await readJson(req)

  const reference = String(body.reference ?? '')
  if (!/^QDL-[A-Z0-9]{20}$/.test(reference)) throw new HttpError(422, 'Invalid reference')
  const tx = await loadTx(admin, { reference })
  if (!tx) throw new HttpError(404, 'Order not found')

  if (tx.status === 'completed') {
    return reply(cors, { reference, status: 'completed', tickets: await ticketsOf(admin, tx.id) })
  }

  const quidlyRef = String(body.quidly_ref ?? tx.payment_gateway_ref ?? '').trim()
  if (!quidlyRef) {
    // nothing to verify yet (customer has not paid, or the webhook has not landed)
    return reply(cors, { reference, status: tx.status === 'failed' || tx.status === 'cancelled' ? 'failed' : 'pending' })
  }
  if (!/^[\w.-]{6,100}$/.test(quidlyRef)) throw new HttpError(422, 'Invalid payment reference')

  return reply(cors, { reference, ...(await settle(admin, tx, quidlyRef)) })
}, { widget: true }))