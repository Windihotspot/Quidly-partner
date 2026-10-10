// events-save: create a draft (step 1) or update any wizard step (details, appearance, lineup, socials).
// POST { event_id?, event_name?, description?, format?, country?, venue_name?, address?, latitude?, longitude?,
//        timezone?, categories?, starts_at?, ends_at?, slug?, socials?, theme?, banner_url?, lineups? }
// Only the keys you send are updated. Dates must be ISO strings (convert local time + tz on the client).
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { cleanHtml, getOwnedEvent, legacyEventDate, loadEventBundle, validateSlug } from '../_shared/events.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const FORMATS = ['in_person', 'online', 'hybrid']
const has = (o: Record<string, any>, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const text = (v: unknown, max: number, field: string, required = false): string | null => {
  const s = String(v ?? '').trim()
  if (!s) {
    if (required) throw new HttpError(422, `${field} is required`)
    return null
  }
  if (s.length > max) throw new HttpError(422, `${field} must be at most ${max} characters`)
  return s
}
const date = (v: unknown, field: string): string | null => {
  if (v === null || v === '') return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) throw new HttpError(422, `${field} is not a valid date`)
  return d.toISOString()
}

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { partner, admin } = await requirePartner(req)
  const body = await readJson(req)

  const imagePrefix = `${SUPABASE_URL}/storage/v1/object/public/event-images/${partner.id}/`
  const image = (v: unknown, field: string): string | null => {
    if (v === null || v === '') return null
    const s = String(v)
    if (!s.startsWith(imagePrefix)) throw new HttpError(422, `${field} must be uploaded through Quidly`)
    return s
  }

  const eventId = typeof body.event_id === 'string' ? body.event_id : null
  let existing: Record<string, any> | null = null
  if (eventId) {
    existing = await getOwnedEvent(admin, partner.id, eventId)
    if (!['draft', 'published'].includes(existing.status)) {
      throw new HttpError(409, `A ${existing.status} event can no longer be edited`)
    }
  } else if (!has(body, 'event_name')) {
    throw new HttpError(422, 'event_name is required to create an event')
  }

  const patch: Record<string, any> = {}

  if (has(body, 'event_name')) patch.event_name = text(body.event_name, 75, 'Event name', true)
  if (has(body, 'description')) {
    const raw = String(body.description ?? '')
    if (raw.length > 20000) throw new HttpError(422, 'Description is too long')
    patch.description = raw.trim() ? cleanHtml(raw) : null
  }
  if (has(body, 'format')) {
    if (!FORMATS.includes(body.format)) throw new HttpError(422, 'Invalid event format')
    patch.format = body.format
  }
  if (has(body, 'country')) patch.country = text(body.country, 60, 'Country')
  if (has(body, 'venue_name')) patch.venue_name = text(body.venue_name, 200, 'Venue name')
  if (has(body, 'address')) patch.address = text(body.address, 300, 'Address')
  for (const k of ['latitude', 'longitude'] as const) {
    if (has(body, k)) {
      if (body[k] === null) patch[k] = null
      else {
        const n = Number(body[k])
        const lim = k === 'latitude' ? 90 : 180
        if (!Number.isFinite(n) || Math.abs(n) > lim) throw new HttpError(422, `Invalid ${k}`)
        patch[k] = n
      }
    }
  }
  if (has(body, 'timezone')) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: String(body.timezone) })
      patch.timezone = String(body.timezone)
    } catch {
      throw new HttpError(422, 'Invalid timezone')
    }
  }
  if (has(body, 'categories')) {
    if (!Array.isArray(body.categories) || body.categories.length > 5) {
      throw new HttpError(422, 'Choose up to 5 categories')
    }
    patch.categories = [...new Set(body.categories.map((c: unknown) => String(c).trim()).filter(Boolean))]
  }
  if (has(body, 'starts_at')) patch.starts_at = date(body.starts_at, 'Start date')
  if (has(body, 'ends_at')) patch.ends_at = date(body.ends_at, 'End date')
  if (has(body, 'theme')) patch.theme = text(body.theme, 50, 'Theme')
  if (has(body, 'banner_url')) patch.banner_url = image(body.banner_url, 'Image')

  if (has(body, 'slug')) {
    if (existing?.status === 'published') throw new HttpError(409, 'The URL cannot be changed after publishing')
    patch.slug = validateSlug(body.slug)
  }

  if (has(body, 'socials')) {
    const s = body.socials ?? {}
    const socials: Record<string, string> = {}
    const website = text(s.website, 200, 'Website')
    if (website) {
      if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(website)) throw new HttpError(422, 'Website must start with http:// or https://')
      socials.website = website
    }
    const ig = text(s.instagram, 40, 'Instagram')?.replace(/^@/, '')
    if (ig) {
      if (!/^[A-Za-z0-9._]{1,30}$/.test(ig)) throw new HttpError(422, 'Invalid Instagram handle')
      socials.instagram = ig
    }
    const x = text(s.x, 40, 'X handle')?.replace(/^@/, '')
    if (x) {
      if (!/^[A-Za-z0-9_]{1,15}$/.test(x)) throw new HttpError(422, 'Invalid X (Twitter) handle')
      socials.x = x
    }
    const fb = text(s.facebook, 200, 'Facebook URL')
    if (fb) {
      if (!/^https?:\/\/(www\.)?(facebook|fb)\.com\/[^\s]+$/i.test(fb)) throw new HttpError(422, 'Invalid Facebook URL')
      socials.facebook = fb
    }
    patch.socials = socials
  }

  // cross-field date check against the effective values
  const starts = has(patch, 'starts_at') ? patch.starts_at : existing?.starts_at
  const ends = has(patch, 'ends_at') ? patch.ends_at : existing?.ends_at
  if (starts && ends && new Date(ends) <= new Date(starts)) {
    throw new HttpError(422, 'End date must be after the start date')
  }

  // keep legacy columns in sync for older code paths
  if (has(patch, 'starts_at')) patch.event_date = patch.starts_at ? legacyEventDate(patch.starts_at) : null
  if (has(patch, 'venue_name') || has(patch, 'address')) {
    const v = has(patch, 'venue_name') ? patch.venue_name : existing?.venue_name
    const a = has(patch, 'address') ? patch.address : existing?.address
    patch.location = [v, a].filter(Boolean).join(', ') || null
  }

  // lineups: validate before touching the DB
  let lineupRows: Array<Record<string, any>> | null = null
  if (has(body, 'lineups')) {
    if (!Array.isArray(body.lineups) || body.lineups.length > 50) throw new HttpError(422, 'Too many lineup entries (max 50)')
    lineupRows = body.lineups.map((l: any, i: number) => ({
      title: text(l.title, 60, 'Lineup title', true),
      name: text(l.name, 100, 'Lineup name', true),
      image_url: image(l.image_url ?? null, 'Lineup image'),
      sort_order: i,
    }))
  }

  let id = eventId
  if (!existing) {
    const { data, error } = await admin
      .from('events')
      .insert({ ...patch, partner_id: partner.id, status: 'draft' })
      .select('id')
      .single()
    if (error) throw mapDbError(error)
    id = data.id
  } else if (Object.keys(patch).length) {
    const { error } = await admin.from('events').update(patch).eq('id', id).eq('partner_id', partner.id)
    if (error) throw mapDbError(error)
  }

  if (lineupRows && id) {
    const { data: old } = await admin.from('event_lineups').select('id').eq('event_id', id)
    if (lineupRows.length) {
      const { error } = await admin.from('event_lineups').insert(lineupRows.map((r) => ({ ...r, event_id: id })))
      if (error) throw error
    }
    const oldIds = (old ?? []).map((r) => r.id)
    if (oldIds.length) await admin.from('event_lineups').delete().in('id', oldIds)
  }

  return reply(cors, await loadEventBundle(admin, partner, id!), existing ? 200 : 201)
}))

function mapDbError(e: { code?: string; message: string }) {
  if (e.code === '23505') return new HttpError(409, 'That URL is already taken. Please choose another.')
  return e
}
