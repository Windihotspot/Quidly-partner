// widget-create-transaction: called by the Quidly payment widget to start a purchase.
// POST { event_id | slug, ticket_type_id, quantity, customer: { name, email, phone? },
//        payment_method?: 'card'|'bank_transfer'|'ussd', widget_session_id?, callback_url? }
// Optional header: x-quidly-key (partner-embedded widget). No key = Quidly-hosted event page.
// Deploy with --no-verify-jwt.
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { resolveApiKey } from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { initializeTransaction } from '../_shared/gateway.ts'
import { queuePartnerWebhook } from '../_shared/webhooks.ts'

const HOLD_MINUTES = 15
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const METHODS = ['card', 'bank_transfer', 'ussd'] as const

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const admin = getAdminClient()
  const apiKey = await resolveApiKey(admin, req)
  const body = await readJson(req)

  // ---- validate input ------------------------------------------------------
  const c = body.customer ?? {}
  const name = String(c.name ?? '').trim()
  const email = String(c.email ?? '').trim().toLowerCase()
  const phone = c.phone ? String(c.phone).trim() : null
  if (name.length < 2 || name.length > 100) throw new HttpError(422, 'Enter your full name')
  if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(422, 'Enter a valid email address')
  if (phone && !/^[+\d][\d\s-]{6,20}$/.test(phone)) throw new HttpError(422, 'Enter a valid phone number')

  const qty = Number(body.quantity ?? 1)
  if (!Number.isInteger(qty) || qty < 1) throw new HttpError(422, 'Invalid quantity')

  const method = (body.payment_method ?? 'card') as (typeof METHODS)[number]
  if (!METHODS.includes(method)) throw new HttpError(422, 'Unsupported payment method')

  const callbackUrl = body.callback_url ? String(body.callback_url) : undefined
  if (callbackUrl && !/^https?:\/\//i.test(callbackUrl)) throw new HttpError(422, 'Invalid callback_url')

  const ticketTypeId = String(body.ticket_type_id ?? '')
  if (!ticketTypeId) throw new HttpError(422, 'ticket_type_id is required')

  // ---- event + ticket checks ----------------------------------------------
  let eq = admin.from('events').select('id, partner_id, event_name, slug, ends_at').eq('status', 'published')
  if (body.event_id) eq = eq.eq('id', String(body.event_id))
  else if (body.slug) eq = eq.eq('slug', String(body.slug).toLowerCase())
  else throw new HttpError(422, 'event_id or slug is required')

  const { data: event } = await eq.maybeSingle()
  if (!event) throw new HttpError(404, 'Event not found or not on sale')
  if (apiKey && apiKey.partner_id !== event.partner_id) throw new HttpError(403, 'This API key cannot sell tickets for this event')
  if (event.ends_at && new Date(event.ends_at) < new Date()) throw new HttpError(409, 'This event has ended')

  const { data: owner } = await admin.from('partners').select('status, kyc_status').eq('id', event.partner_id).maybeSingle()
  if (!owner || owner.status === 'suspended' || ['suspended', 'rejected'].includes(owner.kyc_status)) {
    throw new HttpError(403, 'Ticket sales are unavailable for this event')
  }

  const { data: ticket } = await admin.from('ticket_types').select('*').eq('id', ticketTypeId).eq('event_id', event.id).maybeSingle()
  if (!ticket) throw new HttpError(404, 'Ticket not found')
  if (ticket.invite_only) throw new HttpError(403, 'This ticket is invite-only')
  if (qty > ticket.max_per_order) throw new HttpError(422, `You can buy at most ${ticket.max_per_order} of this ticket per order`)

  const amount = Math.round(Number(ticket.price) * qty * 100) / 100

  // ---- reserve stock atomically (row-locked in SQL) -------------------------
  const { data: reserved, error: rErr } = await admin.rpc('reserve_ticket_stock', { p_ticket_type_id: ticket.id, p_qty: qty })
  if (rErr) throw rErr
  if (!reserved) throw new HttpError(409, 'Not enough tickets remaining')
  const release = () => admin.rpc('release_ticket_stock', { p_ticket_type_id: ticket.id, p_qty: qty })

  const reference = `QDL-${crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString()

  const { data: tx, error: txErr } = await admin
    .from('transactions')
    .insert({
      event_id: event.id,
      partner_id: event.partner_id,
      ticket_type_id: ticket.id,
      quantity: qty,
      reference,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      amount,
      currency: 'NGN',
      payment_method: method,
      status: 'pending',
      quidly_widget_session_id: body.widget_session_id ? String(body.widget_session_id).slice(0, 100) : null,
      attempted_at: new Date().toISOString(),
      metadata: {
        expires_at: expiresAt,
        source: apiKey ? 'partner_widget' : 'quidly_page',
        key_environment: apiKey?.environment ?? null,
        event_name: event.event_name,
        ticket_name: ticket.name,
        unit_price: ticket.price,
      },
    })
    .select('id, partner_id')
    .single()

  if (txErr || !tx) {
    await release()
    throw txErr ?? new Error('Could not create transaction')
  }

  // ---- free tickets complete immediately -----------------------------------
  if (amount === 0) {
    const { data: result, error } = await admin.rpc('complete_transaction', { p_reference: reference, p_gateway_ref: null })
    if (error || !result?.ok) {
      await admin.rpc('fail_transaction', { p_reference: reference, p_reason: 'completion_failed' })
      throw new HttpError(500, 'Could not issue your ticket. Please try again.')
    }
    await queuePartnerWebhook(admin, tx, 'ticket.purchased', {
      reference, event_id: event.id, ticket_type_id: ticket.id, quantity: qty,
      amount: 0, currency: 'NGN', customer: { name, email, phone }, tickets: result.tickets,
    })
    return reply(cors, { reference, status: 'completed', amount: 0, currency: 'NGN', tickets: result.tickets }, 201)
  }

  // ---- paid: start gateway payment -----------------------------------------
  try {
    const init = await initializeTransaction({
      email, amount, reference, channel: method, callbackUrl,
      metadata: { quidly_transaction_id: tx.id, event_id: event.id, ticket_type_id: ticket.id, quantity: qty },
    })
    return reply(cors, {
      reference, status: 'pending', amount, currency: 'NGN', expires_at: expiresAt,
      authorization_url: init.authorization_url, access_code: init.access_code,
    }, 201)
  } catch (e) {
    await admin.rpc('fail_transaction', { p_reference: reference, p_reason: 'gateway_init_failed' })
    throw e
  }
}, { widget: true }))
