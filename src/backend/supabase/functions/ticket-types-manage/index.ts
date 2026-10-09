// ticket-types-manage: create / update / delete / reorder / list ticket types for an event.
// POST { action, event_id, ticket_type_id?, ticket?, order? }
//   ticket: { name, description, kind: 'single'|'group', group_size?, is_free, invite_only,
//             price, quantity (null = unlimited), max_per_order }
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { getOwnedEvent, hasVerifiedPayout } from '../_shared/events.ts'

const FIELDS = ['name', 'description', 'kind', 'group_size', 'is_free', 'invite_only', 'price', 'quantity', 'max_per_order'] as const
const MAX_TICKET_TYPES = 20

function buildTicket(input: Record<string, any>, existing?: Record<string, any>) {
  const c: Record<string, any> = existing
    ? Object.fromEntries(FIELDS.map((k) => [k, existing[k]]))
    : { kind: 'single', group_size: null, is_free: false, invite_only: false, price: 0, quantity: null, max_per_order: 5 }
  for (const k of FIELDS) if (input && k in input) c[k] = input[k]

  c.name = String(c.name ?? '').trim()
  if (!c.name || c.name.length > 75) throw new HttpError(422, 'Ticket name is required (max 75 characters)')
  c.description = String(c.description ?? '').trim()
  if (!c.description || c.description.length > 280) throw new HttpError(422, 'Ticket description is required (max 280 characters)')

  if (!['single', 'group'].includes(c.kind)) throw new HttpError(422, 'Invalid ticket kind')
  if (c.kind === 'group') {
    const size = Number(c.group_size)
    if (!Number.isInteger(size) || size < 2 || size > 100) throw new HttpError(422, 'Group size must be between 2 and 100')
    c.group_size = size
  } else {
    c.group_size = null
  }

  c.is_free = Boolean(c.is_free)
  c.invite_only = Boolean(c.invite_only)
  if (c.is_free) {
    c.price = 0
  } else {
    const p = Number(c.price)
    if (!Number.isFinite(p) || p <= 0 || p > 10_000_000) throw new HttpError(422, 'Enter a valid ticket price')
    c.price = Math.round(p * 100) / 100
  }

  if (c.quantity === null || c.quantity === undefined || c.quantity === '') {
    c.quantity = null
  } else {
    const q = Number(c.quantity)
    if (!Number.isInteger(q) || q < 1 || q > 1_000_000) throw new HttpError(422, 'Enter a valid ticket quantity')
    c.quantity = q
  }

  const m = Number(c.max_per_order)
  if (!Number.isInteger(m) || m < 1 || m > 20) throw new HttpError(422, 'Order limit must be between 1 and 20')
  c.max_per_order = m
  return c
}

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { partner, admin } = await requirePartner(req)
  const body = await readJson(req)

  const action = String(body.action ?? '')
  const eventId = String(body.event_id ?? '')
  if (!eventId) throw new HttpError(422, 'event_id is required')

  const event = await getOwnedEvent(admin, partner.id, eventId)
  if (!['draft', 'published'].includes(event.status)) {
    throw new HttpError(409, `Tickets cannot be changed on a ${event.status} event`)
  }

  const list = async () => {
    const { data, error } = await admin.from('ticket_types').select('*').eq('event_id', eventId).order('sort_order')
    if (error) throw error
    return data ?? []
  }
  const getTicket = async () => {
    const id = String(body.ticket_type_id ?? '')
    if (!id) throw new HttpError(422, 'ticket_type_id is required')
    const { data, error } = await admin.from('ticket_types').select('*').eq('id', id).eq('event_id', eventId).maybeSingle()
    if (error) throw error
    if (!data) throw new HttpError(404, 'Ticket not found')
    return data
  }
  const payoutError = () =>
    new HttpError(422, 'Add a valid bank account in NGN before adding paid tickets to a published event')

  if (action === 'list') return reply(cors, { ticket_types: await list() })

  if (action === 'create') {
    const row = buildTicket(body.ticket ?? {})
    const current = await list()
    if (current.length >= MAX_TICKET_TYPES) throw new HttpError(409, `You can create up to ${MAX_TICKET_TYPES} tickets per event`)
    if (event.status === 'published' && !row.is_free && !(await hasVerifiedPayout(admin, partner.id))) throw payoutError()

    const sort_order = current.length ? Math.max(...current.map((t) => t.sort_order)) + 1 : 0
    const { error } = await admin.from('ticket_types').insert({ ...row, event_id: eventId, sort_order, currency: 'NGN' })
    if (error) throw error
    return reply(cors, { ticket_types: await list() }, 201)
  }

  if (action === 'update') {
    const existing = await getTicket()
    const row = buildTicket(body.ticket ?? {}, existing)

    if (row.quantity !== null && row.quantity < existing.quantity_sold) {
      throw new HttpError(409, `Quantity cannot be lower than the ${existing.quantity_sold} already sold or reserved`)
    }
    if (
      existing.quantity_sold > 0 &&
      (row.is_free !== existing.is_free || Number(row.price) !== Number(existing.price) || row.kind !== existing.kind)
    ) {
      throw new HttpError(409, 'Price, free/paid and single/group cannot be changed once tickets have been sold')
    }
    if (event.status === 'published' && existing.is_free && !row.is_free && !(await hasVerifiedPayout(admin, partner.id))) {
      throw payoutError()
    }

    const { error } = await admin.from('ticket_types').update(row).eq('id', existing.id).eq('event_id', eventId)
    if (error) throw error
    return reply(cors, { ticket_types: await list() })
  }

  if (action === 'delete') {
    const existing = await getTicket()
    if (existing.quantity_sold > 0) throw new HttpError(409, 'This ticket has sales and cannot be deleted')
    if (event.status === 'published' && (await list()).length <= 1) {
      throw new HttpError(409, 'A published event needs at least one ticket. Unpublish first or add another ticket.')
    }
    const { error } = await admin.from('ticket_types').delete().eq('id', existing.id).eq('event_id', eventId)
    if (error) throw error
    return reply(cors, { ticket_types: await list() })
  }

  if (action === 'reorder') {
    const order: unknown = body.order
    const current = await list()
    const ids = current.map((t) => t.id).sort()
    if (!Array.isArray(order) || [...order].sort().join() !== ids.join()) {
      throw new HttpError(422, 'order must contain every ticket id for this event exactly once')
    }
    for (let i = 0; i < order.length; i++) {
      const { error } = await admin.from('ticket_types').update({ sort_order: i }).eq('id', order[i]).eq('event_id', eventId)
      if (error) throw error
    }
    return reply(cors, { ticket_types: await list() })
  }

  throw new HttpError(422, 'Unknown action. Use list, create, update, delete or reorder')
}))
