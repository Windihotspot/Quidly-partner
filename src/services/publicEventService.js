// src/services/publicEventService.js
// Public (no login) endpoints. Both functions must be deployed with --no-verify-jwt.
import ApiService from '@/services/api'

export const publicEventService = {
  getEvent: (slug) => ApiService.get(`/public-event?slug=${encodeURIComponent(slug)}`),

  // { event_id, ticket_type_id, quantity, customer:{name,email,phone?}, widget_session_id?, callback_url? }
  createTransaction: (payload) => ApiService.post('/widget-create-transaction', payload),
  confirmPayment: async (reference, quidly_ref) => {
  const res = await ApiService.post('/payment-confirm', { reference, quidly_ref })
  return res?.data ?? res
},
}
