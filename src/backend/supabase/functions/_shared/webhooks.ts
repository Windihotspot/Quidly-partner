// _shared/webhooks.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

/** Queue an outbound webhook for the partner. Never throws (must not break payments). */
export async function queuePartnerWebhook(
  admin: SupabaseClient,
  tx: { id: string; partner_id: string },
  eventType: string,
  payload: Record<string, unknown>,
) {
  try {
    const { data: p } = await admin.from('partners').select('webhook_url').eq('id', tx.partner_id).maybeSingle()
    if (!p?.webhook_url) return
    await admin.from('webhook_events').insert({
      partner_id: tx.partner_id,
      event_type: eventType,
      transaction_id: tx.id,
      payload,
      delivery_status: 'pending',
      next_retry_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('queuePartnerWebhook failed', e)
  }
}
