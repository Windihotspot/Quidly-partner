// settlements-manage: the partner's settlements page.
// POST { action: 'overview' | 'detail' | 'report', ... }
//   overview { status?: 'all'|'paid'|'processing'|'failed', limit?, offset? }
//   detail   { settlement_id }
//   report   { settlement_id }  -> { filename, csv }
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { loadPolicy, publicSettlement, maskAccount, csvRow } from '../_shared/settlements.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const STATUS_FILTERS: Record<string, string[]> = {
  paid: ['paid'],
  processing: ['pending', 'processing'],
  failed: ['failed'],
}

async function loadSale(admin: SupabaseClient, settlementId: string, partnerId: string) {
  const { data, error } = await admin
    .from('transactions')
    .select('reference, completed_at, amount, platform_fee, refunded_amount, quantity, metadata, events(event_name)')
    .eq('settlement_id', settlementId)
    .eq('partner_id', partnerId)
    .order('completed_at', { ascending: true })
    .limit(5000)
  if (error) throw error
  return (data ?? []).map((t: any) => {
    const ev = Array.isArray(t.events) ? t.events[0] : t.events
    const amount = Number(t.amount), fee = Number(t.platform_fee ?? 0), refunded = Number(t.refunded_amount ?? 0)
    return {
      reference: t.reference, completed_at: t.completed_at, event_name: ev?.event_name ?? 'Unknown event',
      ticket_name: t.metadata?.ticket_name ?? null, quantity: t.quantity,
      amount, fee, refunded, net: Math.round((amount - fee - refunded) * 100) / 100,
    }
  })
}

async function ownedSettlement(admin: SupabaseClient, id: unknown, partnerId: string) {
  const { data, error } = await admin.from('settlements').select('*').eq('id', String(id ?? '')).eq('partner_id', partnerId).maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Settlement not found')
  return data
}

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { partner, admin } = await requirePartner(req)
  const body = await readJson(req)
  const action = String(body.action ?? 'overview')

  if (action === 'overview') {
    const policy = loadPolicy()
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100)
    const offset = Math.max(Number(body.offset) || 0, 0)
    const filter = STATUS_FILTERS[String(body.status ?? 'all')]

    let list = admin.from('settlements').select('*').eq('partner_id', partner.id).neq('status', 'cancelled')
    if (filter) list = list.in('status', filter)

    const [{ data: p }, rows, all, acct] = await Promise.all([
      admin.from('partners').select('platform_fee_percent').eq('id', partner.id).single(),
      list.order('created_at', { ascending: false }).range(offset, offset + limit), // limit + 1 rows => has_more
      admin.from('settlements').select('gross, fees, refunds, net, status').eq('partner_id', partner.id).neq('status', 'cancelled').limit(5000),
      admin.from('partner_bank_accounts').select('id, bank_name, account_number, account_name, is_verified')
        .eq('partner_id', partner.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1),
    ])
    for (const r of [rows, all, acct]) if (r.error) throw r.error

    const feePercent = p?.platform_fee_percent == null ? policy.fee_percent : Number(p.platform_fee_percent)
    const sum = (f: (s: any) => boolean, k: string) => (all.data ?? []).filter(f).reduce((n, s: any) => n + Number(s[k]), 0)
    const totals = {
      gross: sum(() => true, 'gross'), fees: sum(() => true, 'fees'), refunds: sum(() => true, 'refunds'),
      paid_net: sum((s) => s.status === 'paid', 'net'),
      processing_net: sum((s) => ['pending', 'processing'].includes(s.status), 'net'),
      failed_net: sum((s) => s.status === 'failed', 'net'),
    }

    let balance = null
    if (feePercent !== null) {
      const { data, error } = await admin.rpc('partner_unsettled', { p_partner_id: partner.id, p_fee_percent: feePercent, p_fee_flat: policy.fee_flat })
      if (error) throw error
      balance = { ...data, net: Math.round((data.gross - data.fees - data.refunds) * 100) / 100 }
    }

    const page = rows.data ?? []
    return reply(cors, {
      policy: { hold_days: policy.hold_days, min_payout: policy.min_payout, release: policy.release, fee_percent: feePercent, fee_flat: policy.fee_flat, payout_mode: policy.payout_mode },
      totals,
      balance, // not-yet-settled sales, with fees applied
      payout_account: acct.data?.[0] ? { ...acct.data[0], account_number: maskAccount(acct.data[0].account_number) } : null,
      settlements: page.slice(0, limit).map(publicSettlement),
      has_more: page.length > limit,
    })
  }

  if (action === 'detail') {
    const s = await ownedSettlement(admin, body.settlement_id, partner.id)
    const sales = await loadSale(admin, s.id, partner.id)
    const byEvent = new Map<string, { event_name: string; tickets: number; gross: number; fees: number; refunds: number }>()
    for (const t of sales) {
      const e = byEvent.get(t.event_name) ?? { event_name: t.event_name, tickets: 0, gross: 0, fees: 0, refunds: 0 }
      e.tickets += t.quantity; e.gross += t.amount; e.fees += t.fee; e.refunds += t.refunded
      byEvent.set(t.event_name, e)
    }
    return reply(cors, { settlement: publicSettlement(s), by_event: [...byEvent.values()], sales: sales.slice(0, 100), sales_total: sales.length })
  }

  if (action === 'report') {
    const s = await ownedSettlement(admin, body.settlement_id, partner.id)
    const sales = await loadSale(admin, s.id, partner.id)
    const lines = [
      csvRow(['Settlement', 'Sale reference', 'Date', 'Event', 'Ticket', 'Tickets', 'Gross (NGN)', 'Platform fee (NGN)', 'Refunded (NGN)', 'Net (NGN)']),
      ...sales.map((t) => csvRow([s.reference, t.reference, t.completed_at, t.event_name, t.ticket_name, t.quantity,
        t.amount.toFixed(2), t.fee.toFixed(2), t.refunded.toFixed(2), t.net.toFixed(2)])),
      csvRow(['TOTAL', '', '', '', '', s.ticket_count, Number(s.gross).toFixed(2), Number(s.fees).toFixed(2), Number(s.refunds).toFixed(2), Number(s.net).toFixed(2)]),
    ]
    return reply(cors, { filename: `${s.reference}.csv`, csv: lines.join('\r\n') })
  }

  throw new HttpError(422, 'Unknown action')
}))
