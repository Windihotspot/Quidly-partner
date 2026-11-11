import { handle, reply, HttpError } from '../_shared/http.ts'
import { adminCall, must, clean, page } from '../_shared/superadmin.ts'

Deno.serve(handle(async (req, cors) => {
  const { admin, body: b } = await adminCall(req)
  if (b.action === 'get') {
    const [tx, tickets, delivery] = await Promise.all([
      admin.from('transactions').select('*,events(event_name),partners(business_name),ticket_types(name)').eq('id', b.id).single(),
      admin.from('tickets').select('id,ticket_reference,status,checked_in_at').eq('transaction_id', b.id),
      admin.from('ticket_deliveries').select('*').eq('transaction_id', b.id).maybeSingle(),
    ])
    return reply(cors, { transaction: must(tx), tickets: must(tickets), delivery: must(delivery) })
  }
  if (b.action !== 'list') throw new HttpError(400, 'Unknown action')
  const { from, to } = page(b)
  let q = admin.from('transactions').select(
    'id,reference,customer_name,customer_email,amount,platform_fee,refunded_amount,currency,status,payment_method,created_at,completed_at,events(event_name),partners(business_name)',
    { count: 'exact' })
  for (const k of ['status', 'partner_id', 'event_id']) if (b[k]) q = q.eq(k, b[k])
  if (b.from) q = q.gte('created_at', b.from)
  if (b.to) q = q.lte('created_at', b.to)
  if (b.q) { const s = clean(b.q); q = q.or(`reference.ilike.%${s}%,customer_email.ilike.%${s}%,customer_name.ilike.%${s}%`) }
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to)
  if (error) throw error
  return reply(cors, { data, total: count })
}))