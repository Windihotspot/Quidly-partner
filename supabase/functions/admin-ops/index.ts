import { handle, reply, HttpError } from '../_shared/http.ts'
import { adminCall, must, page, plog } from '../_shared/superadmin.ts'

Deno.serve(handle(async (req, cors) => {
  const { admin, user, body: b } = await adminCall(req)
  const { from, to } = page(b)
  switch (b.action) {
    case 'keys_list': {
      let q = admin.from('api_keys').select('id,partner_id,key_prefix,environment,status,scopes,last_used_at,created_at,revoked_at,revoked_reason,partners(business_name)', { count: 'exact' })
      if (b.partner_id) q = q.eq('partner_id', b.partner_id)
      const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to)
      if (error) throw error
      return reply(cors, { data, total: count })
    }
    case 'key_revoke': {
      const k = must(await admin.from('api_keys').update({
        status: 'revoked', revoked_at: new Date().toISOString(), revoked_reason: b.reason ?? 'Revoked by platform admin',
      }).eq('id', b.id).select('partner_id').single())
      await plog(admin, user.id, 'api_key.revoke', 'api_key', b.id, { partner_id: k.partner_id, reason: b.reason }, req)
      return reply(cors, { ok: true })
    }
    case 'webhooks_list': {
      let q = admin.from('webhook_events').select('id,partner_id,event_type,delivery_status,retry_count,next_retry_at,delivered_at,created_at,partners(business_name)', { count: 'exact' })
      if (b.status) q = q.eq('delivery_status', b.status)
      if (b.partner_id) q = q.eq('partner_id', b.partner_id)
      const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to)
      if (error) throw error
      return reply(cors, { data, total: count })
    }
    case 'webhook_retry': {
      must(await admin.from('webhook_events').update({
        delivery_status: 'pending', next_retry_at: new Date().toISOString(),
      }).eq('id', b.id).neq('delivery_status', 'delivered').select('id'))
      await plog(admin, user.id, 'webhook.retry', 'webhook_event', b.id, {}, req)
      return reply(cors, { ok: true })
    }
    case 'audit_list': {
      const t = b.source === 'partner' ? 'partner_audit_logs' : 'platform_audit_logs'
      let q = admin.from(t).select('*', { count: 'exact' })
      if (b.partner_id && t === 'partner_audit_logs') q = q.eq('partner_id', b.partner_id)
      if (b.action_filter) q = q.eq('action', b.action_filter)
      const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to)
      if (error) throw error
      return reply(cors, { data, total: count })
    }
    default: throw new HttpError(400, 'Unknown action')
  }
}))