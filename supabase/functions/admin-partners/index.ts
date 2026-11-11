import { handle, reply, HttpError } from '../_shared/http.ts'
import { adminCall, must, clean, page, plog } from '../_shared/superadmin.ts'

Deno.serve(handle(async (req, cors) => {
  const { admin, user, body: b } = await adminCall(req)
  switch (b.action) {
    case 'list': {
      const { from, to } = page(b)
      let q = admin.from('partners').select(
        'id,business_name,contact_name,email,phone,status,kyc_status,platform_fee_percent,country,created_at',
        { count: 'exact' }).eq('role', 'partner')
      if (b.status) q = q.eq('status', b.status)
      if (b.kyc_status) q = q.eq('kyc_status', b.kyc_status)
      if (b.q) { const s = clean(b.q); q = q.or(`business_name.ilike.%${s}%,email.ilike.%${s}%,contact_name.ilike.%${s}%`) }
      const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to)
      if (error) throw error
      return reply(cors, { data, total: count })
    }
    case 'get': {
      const id = b.partner_id
      const [partner, settings, banks, settlements, events, txs] = await Promise.all([
        admin.from('partners').select('*').eq('id', id).single(),
        admin.from('partner_settings').select('*').eq('partner_id', id).maybeSingle(),
        admin.from('partner_bank_accounts').select('*').eq('partner_id', id),
        admin.from('settlements').select('id,reference,net,status,period_end').eq('partner_id', id)
          .order('created_at', { ascending: false }).limit(5),
        admin.from('events').select('id', { count: 'exact', head: true }).eq('partner_id', id),
        admin.from('transactions').select('amount,platform_fee').eq('partner_id', id).eq('status', 'completed'),
      ])
      const t = must(txs) as any[]
      return reply(cors, {
        partner: must(partner), settings: must(settings), bank_accounts: must(banks),
        recent_settlements: must(settlements), event_count: events.count ?? 0,
        sales: { count: t.length, gross: t.reduce((a, x) => a + +x.amount, 0), fees: t.reduce((a, x) => a + +(x.platform_fee ?? 0), 0) },
      })
    }
    case 'set_status': {
      if (!['pending', 'active', 'suspended'].includes(b.status)) throw new HttpError(400, 'Invalid status')
      const p = must(await admin.from('partners').select('status,role').eq('id', b.partner_id).single())
      if (p.role === 'admin') throw new HttpError(403, 'Cannot change an admin partner')
      must(await admin.from('partners').update({ status: b.status, updated_at: new Date().toISOString() }).eq('id', b.partner_id).select('id'))
      await plog(admin, user.id, 'partner.status', 'partner', b.partner_id, { from: p.status, to: b.status, reason: b.reason }, req)
      return reply(cors, { ok: true })
    }
    case 'set_fee': {
      const f = b.platform_fee_percent
      if (f !== null && !(typeof f === 'number' && f >= 0 && f <= 100)) throw new HttpError(400, 'Fee must be 0-100 or null')
      must(await admin.from('partners').update({ platform_fee_percent: f, updated_at: new Date().toISOString() }).eq('id', b.partner_id).select('id'))
      await plog(admin, user.id, 'partner.fee', 'partner', b.partner_id, { fee: f }, req)
      return reply(cors, { ok: true })
    }
    default: throw new HttpError(400, 'Unknown action')
  }
}))