
 // src/services/publicEventService.js

import ApiService from '@/services/api'

export const publicEventService = {
  getEvent: (slug) =>
    ApiService.get(`/public-event?slug=${encodeURIComponent(slug)}`),

  createTransaction: (payload) =>
    ApiService.post('/widget-create-transaction', payload),

  confirmPayment: async (reference, quidlyRef = '') => {
    const response = await ApiService.post('/payment-confirm', {
      reference,
      quidly_ref: quidlyRef || undefined,
    })

    return response?.data ?? response
  },
}
