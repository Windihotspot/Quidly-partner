// quidly-pay-webhook: Quidly Pay's signed server-to-server callback. Safety net for customers who pay
// and then close the tab, and the only path for slow bank transfers.
// Register in the Quidly Pay dashboard (Webhook URL):  https://<project>.supabase.co/functions/v1/quidly-pay-webhook
// Then "Generate Secret" there and store it:  supabase secrets set QUIDLY_PAY_WEBHOOK_SECRET=...
// Deploy with --no-verify-jwt.
import { handle, reply, requireMethod, HttpError } from '../_shared/http.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { parseCallback, verifyWebhookSignature } from '../_shared/quidlyPay.ts'
import { loadTx, settle, markReversed } from '../_shared/settle.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')

  // 1. authenticate: signature over the exact bytes we received, before parsing anything
  const raw = new Uint8Array(await req.arrayBuffer())
  if (!(await verifyWebhookSignature(raw, req.headers.get('x-quidly-signature')))) {
    throw new HttpError(401, 'invalid signature')
  }
  let payload: Record<string, any>
  try { payload = JSON.parse(new TextDecoder().decode(raw)) } catch { throw new HttpError(400, 'Invalid JSON body') }

  const { eventType, quidlyRef, reference } = parseCallback(payload)
  const admin = getAdminClient()
  const ack = (extra: Record<string, unknown> = {}) => reply(cors, { received: true, ...extra })

  const tx = await loadTx(admin, { reference, gatewayRef: quidlyRef })
  if (!tx) return ack({ ignored: 'unknown_order' }) // 200 so they stop retrying
  const ref = quidlyRef ?? tx.payment_gateway_ref

  try {
    switch (eventType) {
      case 'payment.success': {
        if (!ref) return ack({ ignored: 'no_reference' })
        return ack({ status: (await settle(admin, tx, ref)).status }) // verifies via the API, idempotent
      }
      case 'payment.reversed':
        await markReversed(admin, tx)
        return ack({ status: 'reversed' })
      case 'payment.failed':
      case 'payment.expired':
        // deliberately no state change: the customer can retry inside the widget and the unpaid hold expires by itself
        console.log('quidly-pay-webhook', eventType, tx.reference)
        return ack({ status: eventType })
      default:
        return ack({ ignored: 'unknown_event' })
    }
  } catch (e) {
    // permanent mismatch: log and acknowledge. Anything else becomes a 500 so Quidly Pay retries.
    if (e instanceof HttpError && e.status === 409) {
      console.error('quidly-pay-webhook mismatch', tx.reference, e.message)
      return ack({ ignored: 'mismatch' })
    }
    throw e
  }
}, { widget: true }))