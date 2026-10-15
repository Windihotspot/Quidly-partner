// quidly-pay-webhook: Quidly Pay's signed server-to-server callback. Safety net for customers who pay
// and then close the tab, and the only path for slow bank transfers.
// Register in the Quidly Pay dashboard (Webhook URL):  https://<project>.supabase.co/functions/v1/quidly-pay-webhook
// Then "Generate Secret" there and store it:  supabase secrets set QUIDLY_PAY_WEBHOOK_SECRET=...
// Deploy with --no-verify-jwt.
import { handle, reply, requireMethod, HttpError } from '../_shared/http.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { parseCallback, verifyWebhookSignature } from '../_shared/quidlyPay.ts'
import { loadTx, settle, markReversed } from '../_shared/settle.ts'

Deno.serve(
  handle(
    async (req, cors) => {
      requireMethod(req, 'POST')

      // 1. authenticate: signature over the exact bytes we received, before parsing anything
      const raw = new Uint8Array(await req.arrayBuffer())
      if (!(await verifyWebhookSignature(raw, req.headers.get('x-quidly-signature')))) {
        throw new HttpError(401, 'invalid signature')
      }
      let payload: Record<string, any>

      try {
        const rawText = new TextDecoder().decode(raw)
        payload = JSON.parse(rawText)

        // Temporary debugging: log the exact parsed webhook payload.
        console.log('[quidly-pay-webhook] EXACT_INCOMING_PAYLOAD', JSON.stringify(payload))
      } catch (error) {
        console.error(
          '[quidly-pay-webhook] JSON_PARSE_ERROR',
          error instanceof Error ? error.message : String(error)
        )

        throw new HttpError(400, 'Invalid JSON body')
      }

      const { eventType, quidlyRef, reference } = parseCallback(payload)
      const admin = getAdminClient()
      const ack = (extra: Record<string, unknown> = {}) => reply(cors, { received: true, ...extra })
      const isSuccessEvent = eventType === 'payment.success'

      const merchantRef =
        typeof payload.merchant_ref === 'string' ? payload.merchant_ref.trim() : ''

      const tx = await loadTx(admin, {
        reference: isSuccessEvent ? merchantRef || null : reference,
        gatewayRef: isSuccessEvent ? null : quidlyRef
      })

      if (!tx) {
        console.error('[quidly-pay-webhook] Transaction not found', {
          eventType,
          merchantRefPresent: Boolean(merchantRef)
        })

        return ack({ ignored: 'unknown_order' })
      }
      if (!tx) return ack({ ignored: 'unknown_order' }) // 200 so they stop retrying
      const ref = quidlyRef ?? tx.payment_gateway_ref

      try {
        switch (eventType) {
          case 'payment.success': {
            const merchantRef =
              typeof payload.merchant_ref === 'string' ? payload.merchant_ref.trim() : ''

            const quidlyRef =
              typeof payload.quidly_ref === 'string' ? payload.quidly_ref.trim() : ''

            const amountKobo = payload.amount

            // Require the exact callback fields before settlement.
            if (
              payload.status !== 'success' ||
              !merchantRef ||
              !quidlyRef ||
              !Number.isSafeInteger(amountKobo) ||
              amountKobo <= 0
            ) {
              console.error('[quidly-pay-webhook] Invalid success payload', {
                eventType,
                status: payload.status,
                merchantRefPresent: Boolean(merchantRef),
                quidlyRefPresent: Boolean(quidlyRef),
                amountValid: Number.isSafeInteger(amountKobo) && amountKobo > 0
              })

              return ack({ ignored: 'invalid_success_payload' })
            }

            // Never settle an order using a gateway reference alone here.
            if (merchantRef !== tx.reference) {
              console.error('[quidly-pay-webhook] Merchant reference mismatch', {
                expectedReference: tx.reference,
                receivedReference: merchantRef
              })

              return ack({ ignored: 'mismatch' })
            }

            const result = await settle(admin, tx, quidlyRef, {
              eventType,
              status: payload.status,
              merchantRef,
              quidlyRef,
              amountKobo,
              channel: typeof payload.channel === 'string' ? payload.channel : null
            })

            if (result.status === 'completed') {
              background(
                deliverTickets(admin, tx.id).then((deliveryStatus) => {
                  console.log('[quidly-pay-webhook] ticket_delivery_result', {
                    transactionId: tx.id,
                    reference: tx.reference,
                    deliveryStatus
                  })
                })
              )
            }

            return ack({ status: result.status })
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
    },
    { widget: true }
  )
)
