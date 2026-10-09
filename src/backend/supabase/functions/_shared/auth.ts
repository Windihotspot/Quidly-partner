// _shared/auth.ts
import { getAdminClient, getAuthenticatedUser } from './supabaseAdmin.ts'
import { HttpError } from './http.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export type Partner = {
  id: string
  business_name: string
  email: string
  status: string
  kyc_status: string
  webhook_url: string | null
}

/**
 * Resolves the logged-in user to their partner row.
 * NOTE: the admin client bypasses RLS, so every query in the functions
 * MUST filter by partner.id explicitly.
 */
export async function requirePartner(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) throw new HttpError(401, 'Unauthorized')

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('partners')
    .select('id, business_name, email, status, kyc_status, webhook_url')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new HttpError(403, 'No partner account found for this user')
  if (data.status === 'suspended') throw new HttpError(403, 'Your partner account is suspended')

  return { user, partner: data as Partner, admin }
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Optional API-key auth for the payment widget. Returns null if no key was
 * sent (Quidly-hosted event page), throws if a key was sent but is invalid.
 * ASSUMPTION: api_keys.key_hash = sha256 hex of the full key string.
 */
export async function resolveApiKey(admin: SupabaseClient, req: Request) {
  const key = req.headers.get('x-quidly-key')
  if (!key) return null

  const hash = await sha256Hex(key)
  const { data } = await admin
    .from('api_keys')
    .select('id, partner_id, environment, status, scopes')
    .eq('key_hash', hash)
    .maybeSingle()

  if (!data || data.status !== 'active') throw new HttpError(401, 'Invalid API key')
  if (!(data.scopes ?? []).includes('widget:create_transaction')) {
    throw new HttpError(403, 'API key is missing the widget:create_transaction scope')
  }

  // fire-and-forget
  admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {})
  return data as { id: string; partner_id: string; environment: string }
}
