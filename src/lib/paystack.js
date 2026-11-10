import { supabase } from '@/services/supabase'

const LOG_PREFIX = '[Paystack Checkout]'

/**
 * Initialize payment through Supabase Edge Function
 * and redirect customer to Paystack hosted checkout.
 */
export async function runCheckout(payload) {
  try {
    console.log(`${LOG_PREFIX} Initializing payment`, {
      ticketType: payload.ticket_type_id,
      quantity: payload.quantity
    })

    // Ensure the customer is authenticated.
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Please sign in before purchasing tickets.')
    }

    // Initialize payment on the backend.
    const { data, error } = await supabase.functions.invoke(
      'initialize-payment',
      {
        body: {
          ticket_type_id: payload.ticket_type_id,
          quantity: payload.quantity,
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone || null
        }
      }
    )

    if (error) {
      console.error(`${LOG_PREFIX} Initialization error`, error)
      throw new Error(
        data?.error || error.message || 'Unable to initialize payment.'
      )
    }

    if (!data?.success || !data?.authorization_url || !data?.reference) {
      throw new Error(
        data?.error || 'Invalid Paystack initialization response.'
      )
    }

    console.log(`${LOG_PREFIX} Payment initialized`, {
      reference: data.reference
    })

    // Save reference in session storage for callback recovery.
    sessionStorage.setItem(
      'paystack_pending_reference',
      data.reference
    )

    // Redirect to Paystack hosted checkout.
    window.location.assign(data.authorization_url)

    return data

  } catch (error) {
    console.error(`${LOG_PREFIX} Checkout failed`, error)
    throw error
  }
}

/**
 * Verify payment after Paystack redirects back.
 */
export async function verifyPayment(reference) {
  if (!reference) {
    throw new Error('Payment reference is missing.')
  }

  const { data, error } = await supabase.functions.invoke(
    'verify-payment',
    {
      body: { reference }
    }
  )

  if (error) {
    console.error(`${LOG_PREFIX} Verification error`, error)
    throw new Error(
      data?.error || error.message || 'Payment verification failed.'
    )
  }

  return data
}
