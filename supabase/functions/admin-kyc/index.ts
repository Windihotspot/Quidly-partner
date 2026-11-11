import { handle, reply, HttpError } from '../_shared/http.ts'
import { adminCall, must, page, plog } from '../_shared/superadmin.ts'

const BUCKET = 'kyc-documents' // ASSUMPTION: change to your KYC storage bucket

Deno.serve(handle(async (req, cors) => {
  const { admin, user, body: b } = await adminCall(req)
  switch (b.action) {
    case 'queue': {
      const { from, to } = page(b)
      const { data, count, error } = await admin.from('partner_kyc_submissions')
        .select('id,partner_id,submission_number,status,entity_type,legal_business_name,created_at,partners(business_name,email)', { count: 'exact' })
        .in('status', b.statuses ?? ['submitted', 'under_review'])
        .order('created_at', { ascending: true }).range(from, to)
      if (error) throw error
      return reply(cors, { data, total: count })
    }
    case 'get': {
      const subs = must(await admin.from('partner_kyc_submissions').select('*')
        .eq('partner_id', b.partner_id).order('submission_number', { ascending: false })) as any[]
      const docs = subs.length ? must(await admin.from('partner_kyc_documents').select('*')
        .in('kyc_submission_id', subs.map((s) => s.id))) as any[] : []
      for (const d of docs) {
        const { data } = await admin.storage.from(BUCKET).createSignedUrl(d.storage_path, 600)
        d.url = data?.signedUrl ?? null
      }
      const history = must(await admin.from('partner_kyc_status_history').select('*')
        .eq('partner_id', b.partner_id).order('created_at', { ascending: false }))
      await plog(admin, user.id, 'kyc.viewed', 'partner', b.partner_id, {}, req)
      return reply(cors, { submissions: subs, documents: docs, history })
    }
    case 'verify_document': {
      must(await admin.from('partner_kyc_documents').update({
        verified: !!b.verified, verified_by: b.verified ? user.id : null,
        verified_at: b.verified ? new Date().toISOString() : null,
      }).eq('id', b.document_id).select('id'))
      return reply(cors, { ok: true })
    }
    case 'review': {
      const map: Record<string, string> = { approved: 'approved', rejected: 'rejected', resubmission_required: 'rejected', under_review: 'under_review' }
      if (!map[b.decision]) throw new HttpError(400, 'Invalid decision')
      if (['rejected', 'resubmission_required'].includes(b.decision) && !b.reason?.trim()) throw new HttpError(400, 'Reason required')
      const sub = must(await admin.from('partner_kyc_submissions').select('id,partner_id').eq('id', b.submission_id).single())
      const p = must(await admin.from('partners').select('id,status,kyc_status').eq('id', sub.partner_id).single())
      const now = new Date().toISOString()
      const ok = b.decision === 'approved'
      must(await admin.from('partner_kyc_submissions').update({
        status: map[b.decision], rejection_reason: b.reason ?? null, reviewed_by: user.id, reviewed_at: now,
      }).eq('id', sub.id).select('id'))
      must(await admin.from('partners').update({
        kyc_status: b.decision, updated_at: now,
        ...(ok ? { kyc_approved_at: now, kyc_approved_by: user.id, ...(p.status === 'pending' ? { status: 'active' } : {}) } : {}),
      }).eq('id', p.id).select('id'))
      must(await admin.from('partner_kyc_status_history').insert({
        partner_id: p.id, from_status: p.kyc_status, to_status: b.decision, changed_by: user.id, reason: b.reason ?? null,
      }).select('id'))
      await plog(admin, user.id, `kyc.${b.decision}`, 'partner', p.id, { submission_id: sub.id, reason: b.reason }, req)
      return reply(cors, { ok: true })
    }
    default: throw new HttpError(400, 'Unknown action')
  }
}))