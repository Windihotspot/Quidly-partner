import { handle, reply } from '../_shared/http.ts'
import { adminCall, must } from '../_shared/superadmin.ts'

Deno.serve(handle(async (req, cors) => {
  const { admin } = await adminCall(req)
  return reply(cors, must(await admin.rpc('admin_overview')))
}))