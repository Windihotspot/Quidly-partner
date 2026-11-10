import { supabase } from '@/services/supabase'
import { publicEventService } from '@/services/publicEventService'

export async function runCheckout(payload) {
  try {
    const {
      data: { user },
      error
    } = await (await import('@/services/supabase')).supabase.auth.getUser()

    if (error || !user) {
      throw new Error('Please sign in before purchasing tickets.')
    }

    const result = await publicEventService.initializePaystack({
      ticket_type_id: payload.ticket_type_id,
      quantity: payload.quantity,
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone || null
    })

    if (
      !result?.success ||
      !result?.authorization_url ||
      !result?.reference
    ) {
      throw new Error(
        result?.error || 'Unable to initialize Paystack payment.'
      )
    }

    sessionStorage.setItem(
      'paystack_pending_reference',
      result.reference
    )

    // Redirect to Paystack hosted checkout
    window.location.assign(result.authorization_url)

  } catch (error) {
    console.error('[Paystack]', error)
    throw error
  }
}

export async function verifyPayment(reference) {
  if (!reference) {
    throw new Error('Payment reference is missing.')
  }

  return await publicEventService.verifyPaystack(reference)
}
