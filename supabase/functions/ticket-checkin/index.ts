// ticket-checkin: door scanning for the signed-in partner. POST { action, event_id, ... }
//   verify    { code, manual? }            preview a ticket without admitting it
//   admit     { code, manual?, device? }   admit exactly once (row-locked in SQL)
//   stats     {}                           issued / admitted / remaining, by ticket type, recent scans
//   attendees { q?, page? }                search by name, email or reference (manual check-in)
// `code` is the scanned QR text. With manual:true it may also be a typed ticket reference.
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { readQrToken } from '../_shared/tickets.ts'

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { user, partner, admin } = await requirePartner(req)
  const body = await readJson(req)
  const action = String(body.action ?? '')

  const eventId = String(body.event_id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new HttpError(422, 'Choose an event to scan for')
  const { data: event, error: ee } = await admin.from('events').select('id, event_name, status').eq('id', eventId).eq('partner_id', partner.id).maybeSingle()
  if (ee) throw ee
  if (!event) throw new HttpError(404, 'Event not found')

  const method = body.manual === true ? 'manual' : 'qr'
  const device = clean(body.device, 60) || null

  // verify / admit: resolve the scanned text to a ticket reference
  const resolveRef = async (): Promise<string | null> => {
    const code = clean(body.code, 200)
    if (!code) throw new HttpError(422, 'Nothing was scanned')
    const signed = await readQrToken(code)
    if (signed) return signed
    if (method === 'manual' && /^[\w-]{4,60}$/.test(code)) return code
    await admin.from('ticket_scans').insert({ event_id: event.id, partner_id: partner.id, result: 'invalid', method, scanned_by: user.id, device, note: code.slice(0, 60) })
    return null
  }

  switch (action) {
    case 'admit': {
      const ref = await resolveRef()
      if (!ref) return reply(cors, { result: 'invalid' })
      const { data, error } = await admin.rpc('admit_ticket', {
        p_ticket_reference: ref, p_partner_id: partner.id, p_event_id: event.id, p_scanned_by: user.id, p_device: device, p_method: method,
      })
      if (error) throw error
      return reply(cors, data)
    }

    case 'verify': {
      const ref = await resolveRef()
      if (!ref) return reply(cors, { result: 'invalid' })
      const { data: t, error } = await admin.from('tickets')
        .select('id, event_id, ticket_reference, customer_name, status, checked_in_at, ticket_types(name, kind, group_size), events!inner(partner_id)')
        .eq('ticket_reference', ref).maybeSingle()
      if (error) throw error
      if (!t || (t as any).events.partner_id !== partner.id) return reply(cors, { result: 'not_found' })
      const result = t.event_id !== event.id ? 'wrong_event' : event.status === 'cancelled' ? 'event_cancelled'
        : t.status === 'cancelled' ? 'cancelled' : t.status === 'used' ? 'already_used' : 'valid'
      const tt = (t as any).ticket_types
      return reply(cors, { result, ticket: { id: t.id, reference: t.ticket_reference, holder: t.customer_name, ticket_type: tt?.name, kind: tt?.kind, group_size: tt?.group_size, checked_in_at: t.checked_in_at } })
    }

    case 'stats': {
      const [stats, recent] = await Promise.all([
        admin.rpc('event_checkin_stats', { p_event_id: event.id }),
        admin.from('ticket_scans').select('id, result, method, scanned_at, tickets(customer_name, ticket_reference)').eq('event_id', event.id).order('scanned_at', { ascending: false }).limit(15),
      ])
      if (stats.error) throw stats.error
      if (recent.error) throw recent.error
      const s = stats.data as { issued: number; admitted: number }
      return reply(cors, { ...s, remaining: s.issued - s.admitted, recent: recent.data ?? [] })
    }

    case 'attendees': {
      const page = Math.max(0, Number(body.page) || 0)
      const size = 30
      const term = clean(body.q, 60).replace(/[%,()*\\]/g, ' ').trim()
      let q = admin.from('tickets')
        .select('id, ticket_reference, customer_name, customer_email, status, checked_in_at, ticket_types(name)', { count: 'exact' })
        .eq('event_id', event.id).order('customer_name').range(page * size, page * size + size - 1)
      if (term) q = q.or(`customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,ticket_reference.ilike.%${term}%`)
      const { data, count, error } = await q
      if (error) throw error
      return reply(cors, { items: data ?? [], total: count ?? 0, page, size })
    }

    default:
      throw new HttpError(422, 'Unknown action')
  }
}))