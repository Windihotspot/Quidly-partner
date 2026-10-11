// events-get: list the partner's events, or fetch one with tickets, lineup and publish checklist.
// GET/POST ?event_id=<uuid>  (omit event_id to list)
import { handle, reply, requireMethod } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { eventUrl, loadEventBundle } from '../_shared/events.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'GET', 'POST')
  const { partner, admin } = await requirePartner(req)

  let eventId = new URL(req.url).searchParams.get('event_id')
  if (!eventId && req.method === 'POST') {
    const b = await req.json().catch(() => ({}))
    eventId = b?.event_id ?? null
  }

  if (eventId) return reply(cors, await loadEventBundle(admin, partner, eventId))

  const { data, error } = await admin
    .from('events')
    .select('id, event_name, status, location, slug, starts_at, ends_at, banner_url, format, created_at')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error

  const events = data ?? []

  if (events.length === 0) {
    return reply(cors, { events: [] })
  }

  const eventIds = events.map((event) => event.id)

  const { data: ticketTypes, error: ticketTypesError } = await admin
    .from('ticket_types')
    .select('*')
    .in('event_id', eventIds)
    .order('sort_order', { ascending: true })

  if (ticketTypesError) throw ticketTypesError

  const ticketTypesByEvent = new Map<string, typeof ticketTypes>()

  for (const ticket of ticketTypes ?? []) {
    const existing = ticketTypesByEvent.get(ticket.event_id) ?? []
    existing.push(ticket)
    ticketTypesByEvent.set(ticket.event_id, existing)
  }

  return reply(cors, {
    events: events.map((event) => ({
      ...event,
      event_url: eventUrl(event.slug),
      ticket_types: ticketTypesByEvent.get(event.id) ?? [],
    })),
  })

}))
