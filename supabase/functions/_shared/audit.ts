// _shared/audit.ts
// Append-only trail of sensitive partner actions (payout changes, webhook/secret changes, password changes).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export async function audit(
  admin: SupabaseClient,
  partnerId: string,
  actorId: string,
  action: string,
  metadata: Record<string, unknown> = {},
  req?: Request,
) {
  const ip = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const { error } = await admin.from('partner_audit_logs').insert({ partner_id: partnerId, actor_id: actorId, action, metadata, ip })
  if (error) console.error('audit log failed', error) // never block the user action on this
}