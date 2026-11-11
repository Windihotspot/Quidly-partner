import { handle, reply, HttpError } from '../_shared/http.ts'
import { adminCall, must, plog } from '../_shared/superadmin.ts'

Deno.serve(handle(async (req, cors) => {
  const { admin, user, body: b } = await adminCall(req)
  switch (b.action) {
    case 'list': {
      const admins = must(await admin.from('platform_admins').select('*')) as any[]
      const ps = must(await admin.from('partners').select('auth_user_id,email,contact_name')
        .in('auth_user_id', admins.map((a) => a.user_id))) as any[]
      return reply(cors, admins.map((a) => ({ ...a, ...ps.find((p) => p.auth_user_id === a.user_id) })))
    }
    case 'add': {
      const p = must(await admin.from('partners').select('auth_user_id').eq('email', String(b.email).toLowerCase()).maybeSingle())
      if (!p?.auth_user_id) throw new HttpError(404, 'No account with that email')
      must(await admin.from('platform_admins').upsert({ user_id: p.auth_user_id, role: 'super_admin', is_active: true }).select('user_id'))
      await plog(admin, user.id, 'admin.add', 'user', p.auth_user_id, { email: b.email }, req)
      return reply(cors, { ok: true })
    }
    case 'set_active': {
      if (b.user_id === user.id) throw new HttpError(400, 'You cannot deactivate yourself')
      must(await admin.from('platform_admins').update({ is_active: !!b.is_active }).eq('user_id', b.user_id).select('user_id'))
      await plog(admin, user.id, 'admin.set_active', 'user', b.user_id, { is_active: !!b.is_active }, req)
      return reply(cors, { ok: true })
    }
    default: throw new HttpError(400, 'Unknown action')
  }
}))