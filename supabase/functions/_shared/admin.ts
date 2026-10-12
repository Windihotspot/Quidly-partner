// _shared/admin.ts
import { HttpError } from './http.ts'
import { requirePartner } from './auth.ts'

/** Logged-in user whose partners.role is 'admin'. */
export async function requireAdmin(req: Request) {
  const ctx = await requirePartner(req)
  const { data, error } = await ctx.admin.from('partners').select('role').eq('id', ctx.partner.id).single()
  if (error) throw error
  if (data?.role !== 'admin') throw new HttpError(403, 'Admins only')
  return ctx
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
