// src/services/eventsService.js
// Thin wrapper over the edge functions + storage. No UI state in here.
import ApiService from '@/services/api'
import { supabase } from '@/services/supabase'

export function apiError(e, fallback = 'Something went wrong. Please try again.') {
  return e?.response?.data?.error || e?.message || fallback
}
export function apiDetails(e) {
  return e?.response?.data?.details ?? null
}

export const eventsService = {
  list: () => ApiService.post('/events-get', {}),
  get: (eventId) => ApiService.post('/events-get', { event_id: eventId }),
  save: (payload) => ApiService.post('/events-save', payload),
  checkSlug: (slug, eventId) => ApiService.post('/events-check-slug', { slug, event_id: eventId }),
  publish: (eventId) => ApiService.post('/events-publish', { event_id: eventId, action: 'publish' }),
  unpublish: (eventId) => ApiService.post('/events-publish', { event_id: eventId, action: 'unpublish' }),

  tickets: {
    create: (eventId, ticket) => ApiService.post('/ticket-types-manage', { action: 'create', event_id: eventId, ticket }),
    update: (eventId, ticketTypeId, ticket) =>
      ApiService.post('/ticket-types-manage', { action: 'update', event_id: eventId, ticket_type_id: ticketTypeId, ticket }),
    remove: (eventId, ticketTypeId) =>
      ApiService.post('/ticket-types-manage', { action: 'delete', event_id: eventId, ticket_type_id: ticketTypeId }),
    reorder: (eventId, order) => ApiService.post('/ticket-types-manage', { action: 'reorder', event_id: eventId, order }),
  },

  payout: {
  banks: () => ApiService.post('/payout-account', { action: 'banks' }),
  resolve: (bankSlug, accountNumber) =>
    ApiService.post('/payout-account', { action: 'resolve', bank_slug: bankSlug, account_number: accountNumber }),
  save: (bankSlug, accountNumber) =>
    ApiService.post('/payout-account', { action: 'save', bank_slug: bankSlug, account_number: accountNumber }),
  get: () => ApiService.post('/payout-account', { action: 'get' }),
},

  // Direct-to-storage upload; RLS limits writes to {partner_id}/...
  async uploadImage(file, partnerId, folder = 'drafts') {
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${partnerId}/${folder}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from('event-images')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    if (error) throw error
    return supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl
  },

  // Drafts only (RLS enforces this); ticket types + lineups cascade.
  async deleteDraft(eventId) {
    const { data, error } = await supabase.from('events').delete().eq('id', eventId).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Only draft events can be deleted.')
  },
}
