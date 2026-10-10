// public-event: public data for the event page at /{slug}. No auth. Published events only.
// GET ?slug=<slug>      (deploy with --no-verify-jwt)
import { handle, reply, requireMethod, HttpError } from '../_shared/http.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { eventUrl } from '../_shared/events.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'GET')
  const slug = new URL(req.url).searchParams.get('slug')?.trim().toLowerCase()
  if (!slug) throw new HttpError(422, 'slug is required')

  const admin = getAdminClient()
  const { data: event, error } = await admin
    .from('events')
    .select('id, partner_id, event_name, slug, description, format, country, venue_name, address, latitude, longitude, timezone, starts_at, ends_at, categories, theme, socials, banner_url')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  if (!event) throw new HttpError(404, 'Event not found')

  const [partner, tickets, lineups] = await Promise.all([
    admin.from('partners').select('business_name').eq('id', event.partner_id).maybeSingle(),
    admin.from('ticket_types')
      .select('id, name, description, kind, group_size, is_free, price, currency, quantity, quantity_sold, max_per_order')
      .eq('event_id', event.id)
      .eq('invite_only', false)
      .order('sort_order'),
    admin.from('event_lineups').select('id, title, name, image_url').eq('event_id', event.id).order('sort_order'),
  ])

  const ended = event.ends_at ? new Date(event.ends_at) < new Date() : false
  const { partner_id: _omit, ...publicEvent } = event

  return reply(
    cors,
    {
      event: { ...publicEvent, event_url: eventUrl(event.slug), ended },
      organizer: { business_name: partner.data?.business_name ?? null },
      lineups: lineups.data ?? [],
      tickets: (tickets.data ?? []).map((t) => {
        const remaining = t.quantity === null ? null : Math.max(t.quantity - t.quantity_sold, 0)
        return {
          id: t.id, name: t.name, description: t.description, kind: t.kind, group_size: t.group_size,
          is_free: t.is_free, price: t.price, currency: t.currency, max_per_order: t.max_per_order,
          remaining, // null = unlimited
          sold_out: remaining === 0,
          on_sale: !ended && remaining !== 0,
        }
      }),
    },
    200,
    { 'Cache-Control': 'public, max-age=30' },
  )
}, { widget: true }))
