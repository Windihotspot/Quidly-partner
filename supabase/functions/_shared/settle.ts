// _shared/settle.ts
// Shared payment verification, settlement, ticket issuance and delivery.
// Used by payment-confirm and quidly-pay-webhook.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { HttpError } from './http.ts'
import { verifyPayment, toKobo } from './quidlyPay.ts'
import { queuePartnerWebhook } from './webhooks.ts'
import {
  ensureDelivery,
  deliverTickets,
  background,
} from './deliverTickets.ts'
import { pdfUrl } from './tickets.ts'

export type Tx = Record<string, any>

export type Settlement = {
  status: 'completed' | 'pending' | 'failed' | 'review'
  tickets?: unknown[]
  message?: string
  download_url?: string
}

const COLUMNS =
  'id, partner_id, event_id, ticket_type_id, quantity, reference, status, amount, currency, customer_name, customer_email, customer_phone, payment_gateway_ref, metadata'

const LOG_PREFIX = '[settle]'

function log(
  traceId: string,
  stage: string,
  details: Record<string, unknown> = {},
) {
  console.log(LOG_PREFIX, JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId,
    stage,
    ...details,
  }))
}

function warn(
  traceId: string,
  stage: string,
  details: Record<string, unknown> = {},
) {
  console.warn(LOG_PREFIX, JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId,
    stage,
    ...details,
  }))
}

function logError(
  traceId: string,
  stage: string,
  error: unknown,
  details: Record<string, unknown> = {},
) {
  const e = error instanceof Error ? error : null
  const value = error as Record<string, any> | null

  console.error(LOG_PREFIX, JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId,
    stage,
    errorName: e?.name ?? 'Error',
    errorMessage: e?.message ?? String(value?.message ?? error),
    errorCode: value?.code,
    errorDetails: value?.details,
    errorHint: value?.hint,
    errorStack: e?.stack,
    ...(error instanceof HttpError
      ? { httpStatus: error.status }
      : {}),
    ...details,
  }))
}

// Log payment verification fields needed for debugging.
// Do not log customer email, API credentials, or raw provider responses.
function paymentSummary(v: Record<string, any>) {
  return {
    status: v?.status ?? null,
    reference: v?.reference ?? null,
    amountKobo: v?.amountKobo ?? null,
    currency: v?.currency ?? null,
    channel: v?.channel ?? null,
    emailPresent: Boolean(v?.email),
  }
}

const CHANNELS = ['card', 'bank_transfer', 'ussd', 'bank_pay']

// -------------------------------------------------------------
// LOAD TRANSACTION
// -------------------------------------------------------------

export async function loadTx(
  admin: SupabaseClient,
  by: {
    reference?: string | null
    gatewayRef?: string | null
  },
): Promise<Tx | null> {
  const traceId = crypto.randomUUID()
  const startedAt = Date.now()

  log(traceId, 'loadTx_started', {
    orderReference: by.reference ?? null,
    gatewayReferencePresent: Boolean(by.gatewayRef),
    gatewayReference: by.gatewayRef ?? null,
    lookupOrder: Boolean(by.reference),
    lookupGateway: Boolean(by.gatewayRef),
  })

  try {
    if (by.reference) {
      log(traceId, 'loadTx_reference_lookup_started', {
        reference: by.reference,
      })

      const { data, error } = await admin
        .from('transactions')
        .select(COLUMNS)
        .eq('reference', by.reference)
        .maybeSingle()

      if (error) {
        logError(traceId, 'loadTx_reference_lookup_failed', error, {
          reference: by.reference,
        })
        throw error
      }

      log(traceId, 'loadTx_reference_lookup_result', {
        found: Boolean(data),
        transactionId: data?.id ?? null,
        status: data?.status ?? null,
        gatewayReferencePresent: Boolean(data?.payment_gateway_ref),
      })

      if (data) {
        log(traceId, 'loadTx_completed', {
          found: true,
          lookupMethod: 'reference',
          transactionId: data.id,
          reference: data.reference,
          elapsedMs: Date.now() - startedAt,
        })

        return data
      }
    }

    if (by.gatewayRef) {
      log(traceId, 'loadTx_gateway_lookup_started', {
        gatewayReference: by.gatewayRef,
      })

      const { data, error } = await admin
        .from('transactions')
        .select(COLUMNS)
        .eq('payment_gateway_ref', by.gatewayRef)
        .maybeSingle()

      if (error) {
        logError(traceId, 'loadTx_gateway_lookup_failed', error, {
          gatewayReference: by.gatewayRef,
        })
        throw error
      }

      log(traceId, 'loadTx_gateway_lookup_result', {
        found: Boolean(data),
        transactionId: data?.id ?? null,
        status: data?.status ?? null,
        reference: data?.reference ?? null,
      })

      if (data) {
        log(traceId, 'loadTx_completed', {
          found: true,
          lookupMethod: 'gateway_reference',
          transactionId: data.id,
          reference: data.reference,
          elapsedMs: Date.now() - startedAt,
        })

        return data
      }
    }

    warn(traceId, 'loadTx_not_found', {
      orderReference: by.reference ?? null,
      gatewayReference: by.gatewayRef ?? null,
      elapsedMs: Date.now() - startedAt,
    })

    return null
  } catch (error) {
    logError(traceId, 'loadTx_failed', error, {
      orderReference: by.reference ?? null,
      gatewayReference: by.gatewayRef ?? null,
      elapsedMs: Date.now() - startedAt,
    })

    throw error
  }
}

// -------------------------------------------------------------
// RETRIEVE TICKETS
// -------------------------------------------------------------

export async function ticketsOf(
  admin: SupabaseClient,
  txId: string,
) {
  const traceId = crypto.randomUUID()
  const startedAt = Date.now()

  log(traceId, 'ticketsOf_started', {
    transactionId: txId,
  })

  try {
    const { data, error } = await admin
      .from('tickets')
      .select('id, ticket_reference, ticket_type_id, customer_name')
      .eq('transaction_id', txId)
      .order('created_at')

    if (error) {
      logError(traceId, 'ticketsOf_query_failed', error, {
        transactionId: txId,
      })

      // Preserve the original behavior: return an empty list if the query fails.
      return []
    }

    const tickets = (data ?? []).map((t) => ({
      id: t.id,
      reference: t.ticket_reference,
      ticket_type_id: t.ticket_type_id,
      customer_name: t.customer_name,
    }))

    log(traceId, 'ticketsOf_completed', {
      transactionId: txId,
      ticketCount: tickets.length,
      elapsedMs: Date.now() - startedAt,
    })

    return tickets
  } catch (error) {
    logError(traceId, 'ticketsOf_failed', error, {
      transactionId: txId,
      elapsedMs: Date.now() - startedAt,
    })

    throw error
  }
}

// -------------------------------------------------------------
// FLAG TRANSACTION FOR MANUAL REVIEW
// -------------------------------------------------------------

async function flagReview(
  admin: SupabaseClient,
  tx: Tx,
  quidlyRef: string,
  reason: string,
) {
  const traceId = crypto.randomUUID()
  const startedAt = Date.now()

  warn(traceId, 'flagReview_started', {
    transactionId: tx.id,
    reference: tx.reference,
    transactionStatus: tx.status,
    reason,
    gatewayReference: quidlyRef || null,
  })

  try {
    const { data, error } = await admin
      .from('transactions')
      .update({
        metadata: {
          ...(tx.metadata ?? {}),
          needs_review: reason,
          review_quidly_ref: quidlyRef,
          review_flagged_at: new Date().toISOString(),
        },
      })
      .eq('id', tx.id)
      .select('id, reference, status, metadata')
      .maybeSingle()

    if (error) {
      logError(traceId, 'flagReview_database_update_failed', error, {
        transactionId: tx.id,
        reference: tx.reference,
        reason,
      })

      throw error
    }

    if (!data) {
      warn(traceId, 'flagReview_no_row_updated', {
        transactionId: tx.id,
        reference: tx.reference,
        reason,
      })
    }

    log(traceId, 'flagReview_completed', {
      transactionId: tx.id,
      reference: tx.reference,
      reason,
      rowUpdated: Boolean(data),
      elapsedMs: Date.now() - startedAt,
    })
  } catch (error) {
    logError(traceId, 'flagReview_failed', error, {
      transactionId: tx.id,
      reference: tx.reference,
      reason,
      elapsedMs: Date.now() - startedAt,
    })

    throw error
  }
}

// -------------------------------------------------------------
// SETTLEMENT
// -------------------------------------------------------------
type SignedWebhookPayment = {
  eventType: string
  status: string
  merchantRef: string
  quidlyRef: string
  amountKobo: number
  channel?: string | null
}

export async function settle(
  admin: SupabaseClient,
  tx: Tx,
  quidlyRef: string,
  signedWebhookPayment?: SignedWebhookPayment,
): Promise<Settlement> {
  const traceId = crypto.randomUUID()
  const startedAt = Date.now()

  log(traceId, 'settle_started', {
    transactionId: tx.id,
    reference: tx.reference,
    transactionStatus: tx.status,
    amount: tx.amount,
    currency: tx.currency,
    quantity: tx.quantity,
    gatewayReference: quidlyRef,
    storedGatewayReference: tx.payment_gateway_ref ?? null,
    gatewayReferenceAlreadyBound: Boolean(tx.payment_gateway_ref),
  })

  try {
    // ---------------------------------------------------------
    // 1. Already completed
    // ---------------------------------------------------------
    if (tx.status === 'completed') {
      log(traceId, 'already_completed', {
        transactionId: tx.id,
        reference: tx.reference,
      })

      const tickets = await ticketsOf(admin, tx.id)

      log(traceId, 'completed_order_tickets_loaded', {
        transactionId: tx.id,
        ticketCount: tickets.length,
      })

      log(traceId, 'pdf_url_generation_started', {
        reference: tx.reference,
      })

      const downloadUrl = await pdfUrl(tx.reference)

      log(traceId, 'pdf_url_generation_completed', {
        reference: tx.reference,
        downloadUrlPresent: Boolean(downloadUrl),
        elapsedMs: Date.now() - startedAt,
      })

      return {
        status: 'completed',
        tickets,
        download_url: downloadUrl,
      }
    }

    // ---------------------------------------------------------
    // 2. Prevent binding a different payment
    // ---------------------------------------------------------
    if (
      tx.payment_gateway_ref &&
      tx.payment_gateway_ref !== quidlyRef
    ) {
      warn(traceId, 'gateway_reference_mismatch', {
        transactionId: tx.id,
        reference: tx.reference,
        storedGatewayReference: tx.payment_gateway_ref,
        incomingGatewayReference: quidlyRef,
      })

      throw new HttpError(
        409,
        'This order is linked to a different payment',
      )
    }

    // ---------------------------------------------------------
    // 3. Verify payment directly with Quidly Pay
   // ---------------------------------------------------------
// 3. Verify payment through the appropriate trusted path
// ---------------------------------------------------------

let v: {
  status: 'success' | 'pending' | 'failed'
  amountKobo: number | null
  currency: string | null
  reference: string | null
  email: string | null
  channel: string | null
}

if (signedWebhookPayment) {
  // This path is ONLY for callbacks whose raw request body
  // has already passed Quidly Pay signature verification.
  const callback = signedWebhookPayment

  if (
    callback.eventType !== 'payment.success' ||
    callback.status !== 'success' ||
    callback.merchantRef !== tx.reference ||
    callback.quidlyRef !== quidlyRef ||
    !Number.isSafeInteger(callback.amountKobo) ||
    callback.amountKobo <= 0
  ) {
    throw new HttpError(
      409,
      'The payment callback does not match this order',
    )
  }

  const expectedAmountKobo = toKobo(tx.amount)

  if (callback.amountKobo !== expectedAmountKobo) {
    warn(traceId, 'webhook_amount_mismatch', {
      reference: tx.reference,
      expectedAmountKobo,
      callbackAmountKobo: callback.amountKobo,
    })

    throw new HttpError(
      409,
      'The payment amount does not match this order',
    )
  }

  v = {
    status: 'success',
    amountKobo: callback.amountKobo,
    currency: null, // Callback has no currency field.
    reference: callback.merchantRef,
    email: null, // Callback has no customer email field.
    channel: callback.channel ?? null,
  }

  log(traceId, 'signed_webhook_payment_accepted', {
    reference: tx.reference,
    gatewayReference: quidlyRef,
    amountKobo: callback.amountKobo,
    channel: callback.channel ?? null,
  })
} else {
  log(traceId, 'verifyPayment_started', {
    reference: tx.reference,
    gatewayReference: quidlyRef,
  })

  v = await verifyPayment(quidlyRef)

  log(traceId, 'verifyPayment_completed', {
    orderReference: tx.reference,
    gatewayReference: quidlyRef,
    payment: paymentSummary(v),
    elapsedMs: Date.now() - startedAt,
  })
}
    // ---------------------------------------------------------
    // 4. Validate payment/order reference
    // ---------------------------------------------------------
    log(traceId, 'order_reference_check', {
      expectedReference: tx.reference,
      providerReference: v.reference ?? null,
      providerReferencePresent: Boolean(v.reference),
      matches: !v.reference || v.reference === tx.reference,
    })

    if (v.reference && v.reference !== tx.reference) {
      warn(traceId, 'order_reference_mismatch', {
        expectedReference: tx.reference,
        providerReference: v.reference,
        gatewayReference: quidlyRef,
      })

      throw new HttpError(
        409,
        'This payment belongs to a different order',
      )
    }

    // ---------------------------------------------------------
    // 5. Validate amount
    // ---------------------------------------------------------
    const expectedAmountKobo = toKobo(tx.amount)

    log(traceId, 'payment_amount_check', {
      orderReference: tx.reference,
      orderAmount: tx.amount,
      expectedAmountKobo,
      providerAmountKobo: v.amountKobo ?? null,
      providerAmountPresent: v.amountKobo != null,
      matches: v.amountKobo == null ||
        v.amountKobo === expectedAmountKobo,
    })

    if (
      v.amountKobo != null &&
      v.amountKobo !== expectedAmountKobo
    ) {
      warn(traceId, 'payment_amount_mismatch', {
        reference: tx.reference,
        expectedAmountKobo,
        providerAmountKobo: v.amountKobo,
      })

      throw new HttpError(
        409,
        'The payment amount does not match this order',
      )
    }

    // ---------------------------------------------------------
    // 6. Validate currency
    // ---------------------------------------------------------
    log(traceId, 'payment_currency_check', {
      reference: tx.reference,
      orderCurrency: tx.currency,
      providerCurrency: v.currency ?? null,
      providerCurrencyPresent: Boolean(v.currency),
      matches: !v.currency || v.currency === tx.currency,
    })

    if (v.currency && v.currency !== tx.currency) {
      warn(traceId, 'payment_currency_mismatch', {
        reference: tx.reference,
        orderCurrency: tx.currency,
        providerCurrency: v.currency,
      })

      throw new HttpError(
        409,
        'The payment currency does not match this order',
      )
    }

    // ---------------------------------------------------------
    // 7. Validate customer email without logging PII
    // ---------------------------------------------------------
    const emailMatches = !v.email ||
      v.email.toLowerCase() ===
        String(tx.customer_email).toLowerCase()

    log(traceId, 'payment_customer_check', {
      reference: tx.reference,
      providerEmailPresent: Boolean(v.email),
      orderEmailPresent: Boolean(tx.customer_email),
      emailMatches,
    })

    if (!emailMatches) {
      warn(traceId, 'payment_customer_mismatch', {
        reference: tx.reference,
        gatewayReference: quidlyRef,
      })

      throw new HttpError(
        409,
        'This payment belongs to a different customer',
      )
    }

    log(traceId, 'payment_integrity_checks_passed', {
      reference: tx.reference,
      gatewayReference: quidlyRef,
    })

    // ---------------------------------------------------------
    // 8. Handle failed payment
    // ---------------------------------------------------------
    if (v.status === 'failed') {
      warn(traceId, 'payment_verified_failed', {
        reference: tx.reference,
        gatewayReference: quidlyRef,
        transactionStatus: tx.status,
        action: 'leave_transaction_unchanged',
      })

      return {
        status: 'failed',
        message:
          'Your payment was not successful. You have not been charged for this order.',
      }
    }

    // ---------------------------------------------------------
    // 9. Bind gateway reference
    // ---------------------------------------------------------
    const bind = async () => {
      const bindStartedAt = Date.now()

      const patch: Record<string, unknown> = {
        payment_gateway_ref: quidlyRef,
      }

      if (v.channel && CHANNELS.includes(v.channel)) {
        patch.payment_method = v.channel
      }

      log(traceId, 'gateway_reference_binding_started', {
        transactionId: tx.id,
        reference: tx.reference,
        gatewayReference: quidlyRef,
        paymentChannel: v.channel ?? null,
        channelSupported: Boolean(
          v.channel && CHANNELS.includes(v.channel),
        ),
        patchFields: Object.keys(patch),
      })

      try {
        const { data, error } = await admin
          .from('transactions')
          .update(patch)
          .eq('id', tx.id)
          .or(
            `payment_gateway_ref.is.null,payment_gateway_ref.eq.${quidlyRef}`,
          )
          .select('id, reference, status, payment_gateway_ref, payment_method')
          .maybeSingle()

        if (error) {
          logError(
            traceId,
            'gateway_reference_binding_database_error',
            error,
            {
              transactionId: tx.id,
              reference: tx.reference,
              gatewayReference: quidlyRef,
            },
          )

          if (error.code === '23505') {
            throw new HttpError(
              409,
              'This payment has already been used',
            )
          }

          throw error
        }

        if (!data) {
          warn(traceId, 'gateway_reference_binding_no_row_updated', {
            transactionId: tx.id,
            reference: tx.reference,
            gatewayReference: quidlyRef,
            reason:
              'Transaction may have changed concurrently or no longer matches the binding filter',
          })

          // Preserve the original no-error behavior.
        }

        log(traceId, 'gateway_reference_binding_completed', {
          transactionId: tx.id,
          reference: tx.reference,
          gatewayReference: quidlyRef,
          rowUpdated: Boolean(data),
          storedGatewayReference: data?.payment_gateway_ref ?? null,
          paymentMethod: data?.payment_method ?? null,
          elapsedMs: Date.now() - bindStartedAt,
        })
      } catch (error) {
        logError(traceId, 'gateway_reference_binding_failed', error, {
          transactionId: tx.id,
          reference: tx.reference,
          gatewayReference: quidlyRef,
          elapsedMs: Date.now() - bindStartedAt,
        })

        throw error
      }
    }

    // ---------------------------------------------------------
    // 10. Handle pending payment
    // ---------------------------------------------------------
    if (v.status === 'pending') {
      log(traceId, 'pending_payment_binding_started', {
        reference: tx.reference,
        gatewayReference: quidlyRef,
      })

      await bind()

      log(traceId, 'pending_payment_result', {
        reference: tx.reference,
        gatewayReference: quidlyRef,
        status: 'pending',
        elapsedMs: Date.now() - startedAt,
      })

      return {
        status: 'pending',
        message: 'Waiting for your payment to be confirmed…',
      }
    }

    // ---------------------------------------------------------
    // 11. Verified success: require confirmed amount
    // ---------------------------------------------------------
    log(traceId, 'verified_success_checks', {
      reference: tx.reference,
      providerStatus: v.status,
      amountKoboPresent: v.amountKobo != null,
      transactionStatus: tx.status,
    })

    if (v.amountKobo == null) {
      warn(traceId, 'verified_payment_amount_missing', {
        reference: tx.reference,
        gatewayReference: quidlyRef,
      })

      throw new HttpError(
        502,
        'We could not confirm the payment amount. Please try again.',
      )
    }

    // ---------------------------------------------------------
    // 12. Handle payment after order expiry
    // ---------------------------------------------------------
    if (
      tx.status !== 'pending' &&
      tx.status !== 'processing'
    ) {
      warn(traceId, 'paid_after_expiry_or_unexpected_status', {
        reference: tx.reference,
        gatewayReference: quidlyRef,
        transactionStatus: tx.status,
        expectedStatuses: ['pending', 'processing'],
        action: 'flag_for_manual_review',
      })

      await flagReview(
        admin,
        tx,
        quidlyRef,
        'paid_after_expiry',
      )

      return {
        status: 'review',
        message:
          'We received your payment but your reservation had expired. Our team will sort this out and email you.',
      }
    }

    // ---------------------------------------------------------
    // 13. Bind verified payment reference
    // ---------------------------------------------------------
    log(traceId, 'successful_payment_binding_started', {
      reference: tx.reference,
      gatewayReference: quidlyRef,
    })

    await bind()

    // ---------------------------------------------------------
    // 14. Issue tickets atomically in the database
    // ---------------------------------------------------------
    log(traceId, 'complete_transaction_started', {
      reference: tx.reference,
      gatewayReference: quidlyRef,
      transactionId: tx.id,
      transactionStatus: tx.status,
      amount: tx.amount,
      quantity: tx.quantity,
    })

    const {
      data: result,
      error,
    } = await admin.rpc('complete_transaction', {
      p_reference: tx.reference,
      p_gateway_ref: quidlyRef,
    })

    if (error) {
      logError(traceId, 'complete_transaction_rpc_failed', error, {
        reference: tx.reference,
        gatewayReference: quidlyRef,
        transactionId: tx.id,
      })

      throw error
    }

    log(traceId, 'complete_transaction_rpc_result', {
      reference: tx.reference,
      transactionId: tx.id,
      resultOk: result?.ok ?? false,
      resultReason: result?.reason ?? null,
      ticketCount: Array.isArray(result?.tickets)
        ? result.tickets.length
        : null,
    })

    if (!result?.ok) {
      warn(traceId, 'ticket_completion_rejected', {
        reference: tx.reference,
        transactionId: tx.id,
        gatewayReference: quidlyRef,
        resultReason: result?.reason ?? null,
        action: 'flag_for_manual_review',
      })

      await flagReview(
        admin,
        tx,
        quidlyRef,
        'complete_failed',
      )

      return {
        status: 'review',
        message:
          'We received your payment but could not issue your tickets yet. Our team will email you shortly.',
      }
    }

    log(traceId, 'ticket_completion_success', {
      reference: tx.reference,
      transactionId: tx.id,
      ticketCount: Array.isArray(result.tickets)
        ? result.tickets.length
        : null,
    })

    // ---------------------------------------------------------
    // 15. Queue partner webhook
    // ---------------------------------------------------------
    try {
      log(traceId, 'partner_webhook_queue_started', {
        reference: tx.reference,
        transactionId: tx.id,
        partnerId: tx.partner_id,
        eventType: 'ticket.purchased',
      })

      await queuePartnerWebhook(
        admin,
        {
          id: tx.id,
          partner_id: tx.partner_id,
        },
        'ticket.purchased',
        {
          reference: tx.reference,
          event_id: tx.event_id,
          ticket_type_id: tx.ticket_type_id,
          quantity: tx.quantity,
          amount: Number(tx.amount),
          currency: tx.currency,
          customer: {
            name: tx.customer_name,
            email: tx.customer_email,
            phone: tx.customer_phone,
          },
          tickets: result.tickets,
        },
      )

      log(traceId, 'partner_webhook_queue_completed', {
        reference: tx.reference,
        transactionId: tx.id,
        eventType: 'ticket.purchased',
      })
    } catch (error) {
      // Existing behavior: do not fail settlement if webhook queueing fails.
      warn(traceId, 'partner_webhook_queue_failed', {
        reference: tx.reference,
        transactionId: tx.id,
        eventType: 'ticket.purchased',
        errorMessage: error instanceof Error
          ? error.message
          : String(error),
        note:
          'Settlement continues. Check duplicate-event handling and webhook retry mechanisms.',
      })
    }

    // ---------------------------------------------------------
    // 16. Record ticket delivery job
    // ---------------------------------------------------------
    log(traceId, 'ensureDelivery_started', {
      reference: tx.reference,
      transactionId: tx.id,
    })

    await ensureDelivery(admin, tx.id)

    log(traceId, 'ensureDelivery_completed', {
      reference: tx.reference,
      transactionId: tx.id,
    })

    // ---------------------------------------------------------
    // 17. Start ticket delivery in the background
    // ---------------------------------------------------------
    log(traceId, 'background_delivery_starting', {
      reference: tx.reference,
      transactionId: tx.id,
    })

    background(deliverTickets(admin, tx.id))

    log(traceId, 'background_delivery_dispatched', {
      reference: tx.reference,
      transactionId: tx.id,
      note:
        'This confirms dispatch only, not successful email delivery.',
    })

    // ---------------------------------------------------------
    // 18. Generate download URL
    // ---------------------------------------------------------
    log(traceId, 'final_ticket_lookup_started', {
      reference: tx.reference,
      transactionId: tx.id,
      rpcReturnedTickets: Array.isArray(result.tickets),
    })

    const finalTickets = result.tickets ??
      await ticketsOf(admin, tx.id)

    log(traceId, 'final_ticket_lookup_completed', {
      reference: tx.reference,
      transactionId: tx.id,
      ticketCount: Array.isArray(finalTickets)
        ? finalTickets.length
        : null,
    })

    log(traceId, 'final_pdf_url_generation_started', {
      reference: tx.reference,
    })

    const downloadUrl = await pdfUrl(tx.reference)

    log(traceId, 'final_pdf_url_generation_completed', {
      reference: tx.reference,
      downloadUrlPresent: Boolean(downloadUrl),
    })

    // ---------------------------------------------------------
    // 19. Settlement finished
    // ---------------------------------------------------------
    const response: Settlement = {
      status: 'completed',
      tickets: finalTickets,
      download_url: downloadUrl,
    }

    log(traceId, 'settle_completed', {
      transactionId: tx.id,
      reference: tx.reference,
      gatewayReference: quidlyRef,
      finalStatus: response.status,
      ticketCount: Array.isArray(response.tickets)
        ? response.tickets.length
        : null,
      downloadUrlPresent: Boolean(response.download_url),
      elapsedMs: Date.now() - startedAt,
    })

    return response
  } catch (error) {
    logError(traceId, 'settle_failed', error, {
      transactionId: tx.id,
      reference: tx.reference,
      gatewayReference: quidlyRef,
      transactionStatus: tx.status,
      elapsedMs: Date.now() - startedAt,
    })

    throw error
  }
}

// -------------------------------------------------------------
// PAYMENT REVERSED: refund / chargeback
// -------------------------------------------------------------

export async function markReversed(
  admin: SupabaseClient,
  tx: Tx,
) {
  const traceId = crypto.randomUUID()
  const startedAt = Date.now()

  warn(traceId, 'markReversed_started', {
    transactionId: tx.id,
    reference: tx.reference,
    transactionStatus: tx.status,
    gatewayReferencePresent: Boolean(tx.payment_gateway_ref),
  })

  try {
    // ---------------------------------------------------------
    // 1. Cancel active tickets
    // ---------------------------------------------------------
    log(traceId, 'reverse_active_tickets_started', {
      transactionId: tx.id,
      reference: tx.reference,
    })

    const {
      data: cancelledTickets,
      error: ticketError,
    } = await admin
      .from('tickets')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', tx.id)
      .eq('status', 'active')
      .select('id')

    if (ticketError) {
      logError(traceId, 'reverse_active_tickets_failed', ticketError, {
        transactionId: tx.id,
        reference: tx.reference,
      })

      throw ticketError
    }

    log(traceId, 'reverse_active_tickets_completed', {
      transactionId: tx.id,
      reference: tx.reference,
      cancelledTicketCount: cancelledTickets?.length ?? 0,
    })

    // ---------------------------------------------------------
    // 2. Flag order for review
    // ---------------------------------------------------------
    log(traceId, 'reverse_flag_review_started', {
      transactionId: tx.id,
      reference: tx.reference,
      reason: 'payment_reversed',
    })

    await flagReview(
      admin,
      tx,
      tx.payment_gateway_ref ?? '',
      'payment_reversed',
    )

    log(traceId, 'reverse_flag_review_completed', {
      transactionId: tx.id,
      reference: tx.reference,
    })

    log(traceId, 'markReversed_completed', {
      transactionId: tx.id,
      reference: tx.reference,
      cancelledTicketCount: cancelledTickets?.length ?? 0,
      elapsedMs: Date.now() - startedAt,
    })
  } catch (error) {
    logError(traceId, 'markReversed_failed', error, {
      transactionId: tx.id,
      reference: tx.reference,
      elapsedMs: Date.now() - startedAt,
    })

    throw error
  }
}
