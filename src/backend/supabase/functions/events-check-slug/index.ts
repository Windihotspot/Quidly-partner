// events-check-slug: live availability check for the "Use custom URL" field.
// POST { slug, event_id? }
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { eventUrl, validateSlug } from '../_shared/events.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { admin } = await requirePartner(req)
  const body = await readJson(req)

  let slug: string
  try {
    slug = validateSlug(body.slug)
  } catch (e) {
    if (e instanceof HttpError) return reply(cors, { available: false, reason: e.message })
    throw e
  }

  let q = admin.from('events').select('id', { head: true, count: 'exact' }).eq('slug', slug)
  if (body.event_id) q = q.neq('id', String(body.event_id))
  const { count, error } = await q
  if (error) throw error

  const available = (count ?? 0) === 0
  return reply(cors, {
    available,
    slug,
    event_url: eventUrl(slug),
    reason: available ? null : 'This URL is already taken',
  })
}))
