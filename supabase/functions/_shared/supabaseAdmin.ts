// _shared/supabaseAdmin.ts
// Service-role client (bypasses RLS) + a helper that resolves the
// calling user from the Authorization header of the incoming request.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string

export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Verifies the JWT sent from the frontend (via the ApiService
 * request interceptor) and returns the authenticated user, or null.
 */
export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const admin = getAdminClient()
  const { data, error } = await admin.auth.getUser(token)

  if (error || !data?.user) return null
  return data.user
}
