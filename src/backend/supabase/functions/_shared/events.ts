// _shared/events.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import sanitizeHtml from 'npm:sanitize-html@2.13.0'
import { HttpError } from './http.ts'
import type { Partner } from './auth.ts'

// e.g. https://quidly.app/e  -> https://quidly.app/e/{slug}
const PUBLIC_EVENT_BASE_URL = (Deno.env.get('PUBLIC_EVENT_BASE_URL') ?? '').replace(/\/$/, '')
const REQUIRE_KYC_TO_PUBLISH = Deno.env.get('REQUIRE_KYC_TO_PUBLISH') === 'true'

export function eventUrl(slug: string | null) {
  return slug ? `${PUBLIC_EVENT_BASE_URL}/${slug}` : null
}

// ---- slugs ---------------------------------------------------------------
const RESERVED = new Set([
  'admin', 'api', 'app', 'login', 'signup', 'register', 'dashboard', 'discover', 'events', 'e',
  'checkout', 'widget', 'partner', 'partners', 'quidly', 'ticket', 'tickets', 'settings', 'help',
  'support', 'pricing', 'terms', 'privacy', 'about', 'contact', 'new', 'create', 'static', 'assets',
])

export function validateSlug(input: unknown): string {
  const slug = String(input ?? '').trim().toLowerCase()
  if (slug.length < 3 || slug.length > 60) throw new HttpError(422, 'URL must be 3 to 60 characters')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new HttpError(422, 'Use only lowercase letters, numbers and single hyphens (no special characters)')
  }
  if (RESERVED.has(slug)) throw new HttpError(422, 'This URL is reserved. Please choose another.')
  return slug
}

// ---- rich text -----------------------------------------------------------
export function cleanHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'strike', 'a', 'h2', 'h3', 'h4',
      'blockquote', 'code', 'pre', 'ul', 'ol', 'li'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
    },
  }).trim()
}

// ---- legacy column sync (events.event_date / events.location) -------------
export function legacyEventDate(iso: string): string {
  // naive Lagos-local timestamp, matches the backfill in migration 001
  return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Africa/Lagos' })
}

// ---- ownership -----------------------------------------------------------
export async function getOwnedEvent(admin: SupabaseClient, partnerId: string, eventId: string) {
  const { data, error } = await admin
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('partner_id', partnerId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Event not found')
  return data
}

export async function hasVerifiedPayout(admin: SupabaseClient, partnerId: string): Promise<boolean> {
  const { count } = await admin
    .from('partner_bank_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .eq('is_verified', true)
  return (count ?? 0) > 0
}

// ---- publish checklist (single source of truth for UI + server) ----------
export type ChecklistItem = { key: string; label: string; done: boolean }

export async function buildChecklist(
  admin: SupabaseClient,
  partner: Pick<Partner, 'id' | 'kyc_status'>,
  event: Record<string, any>,
  ticketTypes: Array<{ is_free: boolean }>,
): Promise<ChecklistItem[]> {
  const needsLocation = event.format !== 'online'
  const detailsDone = Boolean(
    event.event_name && event.description && event.format &&
      (event.categories?.length ?? 0) > 0 &&
      event.starts_at && event.ends_at && new Date(event.ends_at) > new Date() &&
      (!needsLocation || (event.country && (event.venue_name || event.address))),
  )

  const items: ChecklistItem[] = [
    { key: 'details', label: 'Complete your event details (including a future end date)', done: detailsDone },
    { key: 'tickets', label: 'Create at least one ticket', done: ticketTypes.length > 0 },
  ]
  if (ticketTypes.some((t) => !t.is_free)) {
    items.push({
      key: 'payout',
      label: 'Add a valid bank account in NGN',
      done: await hasVerifiedPayout(admin, partner.id),
    })
  }
  if (REQUIRE_KYC_TO_PUBLISH) {
    items.push({
      key: 'kyc',
      label: 'Complete business verification (KYC)',
      done: partner.kyc_status === 'approved',
    })
  }
  return items
}

export async function loadEventBundle(admin: SupabaseClient, partner: Partner, eventId: string) {
  const event = await getOwnedEvent(admin, partner.id, eventId)
  const [lineups, tickets] = await Promise.all([
    admin.from('event_lineups').select('*').eq('event_id', eventId).order('sort_order'),
    admin.from('ticket_types').select('*').eq('event_id', eventId).order('sort_order'),
  ])
  if (lineups.error) throw lineups.error
  if (tickets.error) throw tickets.error

  const checklist = await buildChecklist(admin, partner, event, tickets.data ?? [])
  return {
    event,
    lineups: lineups.data ?? [],
    ticket_types: tickets.data ?? [],
    event_url: eventUrl(event.slug),
    checklist,
    can_publish: checklist.every((i) => i.done),
  }
}
