import { handle, reply, HttpError } from '../_shared/http.ts'
import { adminCall, must, clean, page, plog } from '../_shared/superadmin.ts'

Deno.serve(handle(async (req, cors) => {
  const { admin, user, body: b } = await adminCall(req)
  if (b.action === 'set_status') {
    if (!['draft', 'published', 'cancelled', 'completed'].includes(b.status)) throw new HttpError(400, 'Invalid status')
    const e = must(await admin.from('events').select('status,published_at').eq('id', b.event_id).single())
    must(await admin.from('events').update({
      status: b.status, updated_at: new Date().toISOString(),
      ...(b.status === 'published' && !e.published_at ? { published_at: new Date().toISOString() } : {}),
    }).eq('id', b.event_id).select('id'))
    await plog(admin, user.id, 'event.status', 'event', b.event_id, { from: e.status, to: b.status, reason: b.reason }, req)
    return reply(cors, { ok: true })
  }
  if (b.action !== 'list') throw new HttpError(400, 'Unknown action')
  const { from, to } = page(b)
  let q = admin.from('events').select(
    'id,event_name,slug,status,starts_at,ticket_price,total_capacity,created_at,partners(business_name)', { count: 'exact' })
  if (b.status) q = q.eq('status', b.status)
  if (b.partner_id) q = q.eq('partner_id', b.partner_id)
  if (b.q) q = q.ilike('event_name', `%${clean(b.q)}%`)
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to)
  if (error) throw error
  return reply(cors, { data, total: count })
}))