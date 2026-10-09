// events-publish: publish / unpublish an event. Re-runs the checklist server-side.
// POST { event_id, action: 'publish' | 'unpublish' }
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { loadEventBundle } from '../_shared/events.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { partner, admin } = await requirePartner(req)
  const body = await readJson(req)
  const eventId = String(body.event_id ?? '')
  const action = String(body.action ?? 'publish')
  if (!eventId) throw new HttpError(422, 'event_id is required')

  const bundle = await loadEventBundle(admin, partner, eventId)
  const { event } = bundle

  if (action === 'publish') {
    if (event.status === 'published') return reply(cors, bundle) // idempotent
    if (event.status !== 'draft') throw new HttpError(409, `A ${event.status} event cannot be published`)
    if (!bundle.can_publish) {
      throw new HttpError(422, 'Complete the required steps before publishing', bundle.checklist)
    }
    const { error } = await admin
      .from('events')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('partner_id', partner.id)
    if (error) throw error
    return reply(cors, await loadEventBundle(admin, partner, eventId))
  }

  if (action === 'unpublish') {
    if (event.status !== 'published') throw new HttpError(409, 'Only published events can be unpublished')
    if (bundle.ticket_types.some((t: any) => t.quantity_sold > 0)) {
      throw new HttpError(409, 'Tickets have already been sold or reserved for this event')
    }
    const { error } = await admin
      .from('events')
      .update({ status: 'draft', published_at: null })
      .eq('id', eventId)
      .eq('partner_id', partner.id)
    if (error) throw error
    return reply(cors, await loadEventBundle(admin, partner, eventId))
  }

  throw new HttpError(422, 'Unknown action. Use publish or unpublish')
}))
