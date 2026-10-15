
// Loads the Quidly Pay widget, opens it, and turns its result into a verified order status.
// The widget callback is only a hint: the server verifies the payment before issuing tickets.
import { publicEventService } from '@/services/publicEventService'

const SCRIPT_URL = 'https://securepay.quidly.ng/embedouter.js'
const CLOSE_GRACE_MS = 1500
const POLL_EVERY_MS = 4000
const POLL_FOR_MS = 120_000

const LOG_PREFIX = '[Quidly Checkout]'

let loading = null

function log(...args) {
  console.log(LOG_PREFIX, ...args)
}

function logWarn(...args) {
  console.warn(LOG_PREFIX, ...args)
}

function logError(...args) {
  console.error(LOG_PREFIX, ...args)
}

function getErrorDetails(error) {
  return {
    name: error?.name,
    message: error?.message,
    stack: error?.stack,
    responseStatus: error?.response?.status,
    responseData: error?.response?.data,
    code: error?.code,
  }
}

export function loadQuidlyPay() {
  log('Script load requested', {
    scriptUrl: SCRIPT_URL,
    alreadyAvailable: typeof window.embedQuidlyPay !== 'undefined',
    existingLoadInProgress: Boolean(loading),
  })

  if (window.embedQuidlyPay) {
    log('Quidly Pay script is already available')
    return Promise.resolve()
  }

  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_URL
      s.async = true

      s.onload = () => {
        log('Quidly Pay script loaded successfully', {
          scriptUrl: s.src,
          embedAvailable: typeof window.embedQuidlyPay !== 'undefined',
        })

        if (!window.embedQuidlyPay) {
          loading = null
          s.remove()

          const error = new Error(
            'Quidly Pay script loaded, but window.embedQuidlyPay is unavailable.'
          )

          logError('Script loaded without the expected global', getErrorDetails(error))
          reject(error)
          return
        }

        resolve()
      }

      s.onerror = (event) => {
        loading = null
        s.remove()

        const error = new Error(
          'Could not load the payment window. Check your connection and try again.'
        )

        logError('Quidly Pay script failed to load', {
          scriptUrl: s.src,
          eventType: event?.type,
          error: getErrorDetails(error),
        })

        reject(error)
      }

      log('Appending Quidly Pay script to document.head', {
        scriptUrl: s.src,
      })

      document.head.appendChild(s)
    })
  }

  return loading
}

// Resolves once: { type: 'result', res } | { type: 'closed' }
function openWidget(w) {
  log('Opening payment widget', {
    keyPresent: Boolean(w?.key),
    email: w?.email,
    amount: w?.amount,
    currencyCode: w?.currency_code,
    paymentMethods: w?.paymentmethods,
    reference: w?.reference,
    txRef: w?.reference,
    widgetPresent: Boolean(w),
  })

  return new Promise((resolve, reject) => {
    let done = false
    let closeTimer = null

    const finish = (value) => {
      if (done) {
        logWarn('Widget produced an additional event after completion', {
          eventType: value?.type,
          reference: w?.reference,
        })
        return
      }

      done = true

      if (closeTimer) {
        clearTimeout(closeTimer)
      }

      log('Widget promise resolved', {
        eventType: value?.type,
        reference: w?.reference,
      })

      resolve(value)
    }

    loadQuidlyPay()
      .then(() => {
        log('Initializing Quidly Pay widget', {
          reference: w?.reference,
          amount: w?.amount,
          currencyCode: w?.currency_code,
        })

        try {
          window.embedQuidlyPay.initialize({
            key: w.key,
            email: w.email,
            amount: w.amount, // kobo
            currency_code: w.currency_code,
            paymentmethods: w.paymentmethods,
            reference: w.reference,
            tx_ref: w.reference,

            callback: (res) => {
              // Do not log card details, tokens, or other payment credentials.
              log('Widget callback received', {
                reference: w?.reference,
                response: res,
              })

              if (closeTimer) {
                clearTimeout(closeTimer)
                closeTimer = null
              }

              finish({ type: 'result', res })
            },

            onclose: () => {
              log('Widget onclose fired', {
                reference: w?.reference,
                closeGraceMs: CLOSE_GRACE_MS,
              })

              closeTimer = setTimeout(() => {
                log('Widget close grace period elapsed', {
                  reference: w?.reference,
                  callbackReceived: done,
                })

                finish({ type: 'closed' })
              }, CLOSE_GRACE_MS)
            },
          })

          log('Widget initialize() returned', {
            reference: w?.reference,
          })
        } catch (error) {
          logError('Widget initialization threw an error', {
            reference: w?.reference,
            error: getErrorDetails(error),
          })

          reject(error)
        }
      })
      .catch((error) => {
        logError('Could not prepare payment widget', {
          reference: w?.reference,
          error: getErrorDetails(error),
        })

        reject(error)
      })
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * created is the response from widget-create-transaction:
 * { reference, widget, ... }
 *
 * Returns:
 * { status: 'completed' | 'pending' | 'failed' | 'review' | 'cancelled', tickets?, message? }
 */
export async function runCheckout(created) {
  const checkoutStartedAt = Date.now()

  log('========== CHECKOUT STARTED ==========', {
    timestamp: new Date().toISOString(),
    createdReference: created?.reference,
    widgetPresent: Boolean(created?.widget),
    widgetReference: created?.widget?.reference,
    amount: created?.widget?.amount,
    currencyCode: created?.widget?.currency_code,
    email: created?.widget?.email,
  })

  try {
    if (!created?.reference || !created?.widget) {
      logError('Invalid checkout creation response', {
        hasCreatedResponse: Boolean(created),
        hasReference: Boolean(created?.reference),
        hasWidget: Boolean(created?.widget),
      })

      return {
        status: 'failed',
        message: 'Could not initialize your payment. Please try again.',
      }
    }

    if (created.reference !== created.widget.reference) {
      logWarn('Order reference differs from widget reference', {
        orderReference: created.reference,
        widgetReference: created.widget.reference,
      })
    }

    log('Waiting for widget result', {
      reference: created.reference,
    })

    const out = await openWidget(created.widget)

    log('Widget flow finished', {
      reference: created.reference,
      eventType: out?.type,
      callbackStatus: out?.res?.status,
      quidlyRefPresent: Boolean(out?.res?.quidly_ref),
      elapsedMs: Date.now() - checkoutStartedAt,
    })

    if (out.type === 'closed' || out.res?.status === 'cancelled') {
      logWarn('Checkout cancelled or widget closed', {
        reference: created.reference,
        eventType: out.type,
        callbackStatus: out?.res?.status,
      })

      return { status: 'cancelled' }
    }

    const quidlyRef = out.res?.quidly_ref

    if (!quidlyRef) {
      logError('Widget result did not contain quidly_ref', {
        reference: created.reference,
        callbackStatus: out.res?.status,
        callbackMessage: out.res?.message,
        callbackResponse: out.res,
      })

      return {
        status: 'failed',
        message: out.res?.message || 'Your payment was not completed.',
      }
    }

    log('Submitting payment for server-side verification', {
      orderReference: created.reference,
      quidlyRef,
      verificationMethod: 'initial verification with quidly_ref',
    })

    let verificationAttempt = 1
    let r

    try {
      r = await publicEventService.confirmPayment(
        created.reference,
        quidlyRef
      )

      log('Initial server verification response', {
        orderReference: created.reference,
        quidlyRef,
        attempt: verificationAttempt,
        response: r,
      })
    } catch (error) {
      logError('Initial server verification request failed', {
        orderReference: created.reference,
        quidlyRef,
        attempt: verificationAttempt,
        error: getErrorDetails(error),
      })

      throw error
    }

    const deadline = Date.now() + POLL_FOR_MS

    log('Starting payment status polling', {
      orderReference: created.reference,
      initialStatus: r?.status,
      pollEveryMs: POLL_EVERY_MS,
      pollForMs: POLL_FOR_MS,
      deadline: new Date(deadline).toISOString(),
    })

    while (r.status === 'pending' && Date.now() < deadline) {
      const waitStartedAt = Date.now()

      log('Payment still pending; waiting before next verification', {
        orderReference: created.reference,
        attempt: verificationAttempt,
        nextPollInMs: POLL_EVERY_MS,
        remainingMs: Math.max(0, deadline - Date.now()),
      })

      await sleep(POLL_EVERY_MS)

      if (Date.now() >= deadline) {
        logWarn('Polling deadline reached before another verification', {
          orderReference: created.reference,
          attempt: verificationAttempt,
          waitedMs: Date.now() - waitStartedAt,
        })
        break
      }

      verificationAttempt += 1

      log('Polling server for payment status', {
        orderReference: created.reference,
        attempt: verificationAttempt,
      })

      try {
        // The backend should be able to identify the existing payment
        // from the order reference on subsequent verification requests.
        r = await publicEventService.confirmPayment(created.reference)

        log('Payment polling response received', {
          orderReference: created.reference,
          attempt: verificationAttempt,
          status: r?.status,
          response: r,
          elapsedMs: Date.now() - checkoutStartedAt,
          remainingMs: Math.max(0, deadline - Date.now()),
        })
      } catch (error) {
        logError('Payment polling request failed', {
          orderReference: created.reference,
          attempt: verificationAttempt,
          error: getErrorDetails(error),
        })

        throw error
      }
    }

    if (r?.status === 'pending') {
      logWarn('Payment verification timed out while still pending', {
        orderReference: created.reference,
        finalStatus: r.status,
        attempts: verificationAttempt,
        elapsedMs: Date.now() - checkoutStartedAt,
      })

      return {
        ...r,
        message:
          'Your payment is still being confirmed. We will email your tickets as soon as it lands.',
      }
    }

    log('Final payment verification result', {
      orderReference: created.reference,
      finalStatus: r?.status,
      attempts: verificationAttempt,
      elapsedMs: Date.now() - checkoutStartedAt,
      ticketsPresent: Boolean(r?.tickets),
      ticketCount: Array.isArray(r?.tickets) ? r.tickets.length : undefined,
      message: r?.message,
      response: r,
    })

    log('========== CHECKOUT FINISHED ==========', {
      orderReference: created.reference,
      finalStatus: r?.status,
      totalElapsedMs: Date.now() - checkoutStartedAt,
    })

    return r
  } catch (error) {
    logError('========== CHECKOUT ERROR ==========', {
      orderReference: created?.reference,
      elapsedMs: Date.now() - checkoutStartedAt,
      error: getErrorDetails(error),
    })

    throw error
  }
}