import { HttpError, readJson, requireMethod } from './http.ts'
import { getAdminClient, getAuthenticatedUser } from './supabaseAdmin.ts'

/** POST-only; verifies caller is an active platform super admin; returns parsed body. */
export async function adminCall(req: Request) {
  requireMethod(req, 'POST')
  const user = await getAuthenticatedUser(req)
  if (!user) throw new HttpError(401, 'Unauthorized')
  const admin = getAdminClient()
  const { data, error } = await admin.from('platform_admins').select('role')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(403, 'Super admins only')
  return { user, admin, body: await readJson(req) }
}

export const must = <T>(r: { data: T; error: any }): T => { if (r.error) throw r.error; return r.data }

export const clean = (s: unknown) => String(s ?? '').replace(/[,()%*\\]/g, '').slice(0, 80)

export function page(b: Record<string, any>) {
  const limit = Math.min(Math.max(Number(b.limit) || 20, 1), 100)
  const from = ((Number(b.page) || 1) - 1) * limit
  return { from, to: from + limit - 1 }
}

export async function plog(admin: any, actor: string, action: string, targetType: string,
  targetId: string, metadata: Record<string, unknown> = {}, req?: Request) {
  const ip = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const { error } = await admin.from('platform_audit_logs')
    .insert({ actor_id: actor, action, target_type: targetType, target_id: targetId, metadata, ip })
  if (error) console.error('platform audit failed', error)
}