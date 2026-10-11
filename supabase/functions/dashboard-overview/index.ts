// dashboard-overview: everything the partner dashboard needs in one call.
// POST { days?: number }   (omit / null = all time; affects the stat cards only)
import { handle, reply, readJson, requireMethod } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST', 'GET')
  const { partner, admin } = await requirePartner(req)
  const body = req.method === 'POST' ? await readJson(req) : {}

  const d = Number(body.days)
  const days = Number.isInteger(d) && d >= 1 && d <= 3650 ? d : null
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null

  const [stats, orders, upcoming, allEvents, keys, payout] = await Promise.all([
    admin.rpc('partner_dashboard_stats', { p_partner_id: partner.id, p_since: since }),
    admin
      .from('transactions')
      .select('reference, customer_name, amount, currency, status, quantity, created_at, metadata, events(event_name)')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .limit(8),
    admin
      .from('events')
      .select('id, event_name, starts_at, ends_at, timezone, banner_url, ticket_types(quantity, quantity_sold)')
      .eq('partner_id', partner.id)
      .eq('status', 'published')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(5),
    admin.from('events').select('status').eq('partner_id', partner.id).limit(1000),
    admin
      .from('api_keys')
      .select('id, key_prefix, environment, last_used_at, created_at')
      .eq('partner_id', partner.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('partner_bank_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partner.id)
      .eq('is_active', true)
      .eq('is_verified', true),
  ])

  for (const r of [stats, orders, upcoming, allEvents, keys, payout]) if (r.error) throw r.error

  const byStatus: Record<string, number> = {}
  for (const e of allEvents.data ?? []) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1
  const totalEvents = (allEvents.data ?? []).length

  return reply(cors, {
    period_days: days,
    stats: stats.data,
    recent_orders: (orders.data ?? []).map((t: any) => {
      const ev = Array.isArray(t.events) ? t.events[0] : t.events
      return {
        reference: t.reference,
        customer: t.customer_name,
        event_name: ev?.event_name ?? null,
        ticket_name: t.metadata?.ticket_name ?? null,
        quantity: t.quantity,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        created_at: t.created_at,
      }
    }),
    upcoming_events: (upcoming.data ?? []).map((e: any) => {
      const types = e.ticket_types ?? []
      const unlimited = types.some((t: any) => t.quantity === null)
      return {
        id: e.id,
        event_name: e.event_name,
        starts_at: e.starts_at,
        timezone: e.timezone,
        banner_url: e.banner_url,
        tickets_sold: types.reduce((s: number, t: any) => s + t.quantity_sold, 0),
        capacity: unlimited || !types.length ? null : types.reduce((s: number, t: any) => s + t.quantity, 0),
      }
    }),
    api_keys: keys.data ?? [], // hashed at rest: only the prefix is ever available
    onboarding: {
      business_name: partner.business_name,
      kyc_status: partner.kyc_status,
      has_payout: (payout.count ?? 0) > 0,
      has_event: totalEvents > 0,
      has_published_event: (byStatus.published ?? 0) + (byStatus.completed ?? 0) > 0,
      has_api_key: (keys.data ?? []).length > 0,
      events: { total: totalEvents, draft: byStatus.draft ?? 0, published: byStatus.published ?? 0 },
    },
  })
}))
