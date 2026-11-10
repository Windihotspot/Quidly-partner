// src/services/publicEventService.js
// Public (no login) endpoints. Both functions must be deployed with --no-verify-jwt.
// import ApiService from '@/services/api'

// export const publicEventService = {
//   getEvent: (slug) => ApiService.get(`/public-event?slug=${encodeURIComponent(slug)}`),

//   // { event_id, ticket_type_id, quantity, customer:{name,email,phone?}, widget_session_id?, callback_url? }
//   createTransaction: (payload) => ApiService.post('/widget-create-transaction', payload),
//   confirmPayment: async (reference, quidly_ref) => {
//   const res = await ApiService.post('/payment-confirm', { reference, quidly_ref })
//   return res?.data ?? res
// },
// }


import ApiService from '@/services/api'

export const publicEventService = {
  // Fetch public event
  getEvent: (slug) =>
    ApiService.get(`/public-event?slug=${encodeURIComponent(slug)}`),

  // Existing Quidly transaction
  createTransaction: (payload) =>
    ApiService.post('/widget-create-transaction', payload),

  // Existing Quidly payment confirmation
  confirmPayment: async (reference, quidly_ref) => {
    const res = await ApiService.post('/payment-confirm', {
      reference,
      quidly_ref
    })

    return res?.data ?? res
  },

  // ----------------------------------
  // PAYSTACK PAYMENT INTEGRATION
  // ----------------------------------

  // Initialize Paystack payment
  initializePaystack: async (payload) => {
    const res = await ApiService.post('/initialize-payment', payload)
    return res?.data ?? res
  },

  // Verify Paystack payment
  verifyPaystack: async (reference) => {
    const res = await ApiService.post('/verify-payment', {
      reference
    })

    return res?.data ?? res
  }
}

