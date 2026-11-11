import { handle, reply, HttpError } from '../_shared/http.ts'
import { adminCall, must, plog } from '../_shared/superadmin.ts'

const CATS = ['commercial', 'microfinance', 'psb', 'wallet', 'mortgage_bank', 'merchant_bank', 'finance_company', 'other']

Deno.serve(handle(async (req, cors) => {
  const { admin, user, body: b } = await adminCall(req)
  if (b.action === 'list') return reply(cors, must(await admin.from('banks').select('*').order('name')))
  if (b.action !== 'upsert') throw new HttpError(400, 'Unknown action')
  if (!b.name || !b.slug || !b.code) throw new HttpError(400, 'name, slug and code required')
  if (b.category && !CATS.includes(b.category)) throw new HttpError(400, 'Invalid category')
  const row = {
    name: b.name, slug: b.slug, code: b.code, category: b.category ?? 'commercial',
    payout_eligible: b.payout_eligible ?? true, is_active: b.is_active ?? true, updated_at: new Date().toISOString(),
  }
  const res = b.id
    ? await admin.from('banks').update(row).eq('id', b.id).select().single()
    : await admin.from('banks').insert(row).select().single()
  const data = must(res)
  await plog(admin, user.id, b.id ? 'bank.update' : 'bank.create', 'bank', data.id, row, req)
  return reply(cors, data)
}))