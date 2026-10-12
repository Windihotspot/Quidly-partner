// kyc-manage: everything the partner KYC page needs.
// POST { action, ... } where action is one of:
//   get | save | reopen | withdraw | submit
//   document_upload_url | document_add | document_delete | document_url
// Every action returns the full KYC state (except document_url / document_upload_url).
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import {
  BUCKET, MAX_DOC_BYTES, MAX_DOCS_PER_TYPE, ALLOWED_MIME, REQUIREMENTS, catalog, evaluate,
  validateProfile, publicSubmission,
} from '../_shared/kyc.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const COPY_FIELDS = ['entity_type', 'legal_business_name', 'trading_name', 'business_registration_number',
  'tax_identification_number', 'business_address', 'business_city', 'business_state', 'director_full_name',
  'director_dob', 'director_nin', 'director_bvn', 'director_id_type', 'director_id_number']

// ---- data helpers --------------------------------------------------------------
async function latestSubmission(admin: SupabaseClient, partnerId: string) {
  const { data, error } = await admin
    .from('partner_kyc_submissions')
    .select('*')
    .eq('partner_id', partnerId)
    .order('submission_number', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function docsOf(admin: SupabaseClient, submissionId: string) {
  const { data, error } = await admin
    .from('partner_kyc_documents')
    .select('id, document_type, storage_path, file_name, mime_type, uploaded_at, verified')
    .eq('kyc_submission_id', submissionId)
    .order('uploaded_at')
  if (error) throw error
  return data ?? []
}

async function removeDoc(admin: SupabaseClient, d: { id: string; storage_path: string }) {
  await admin.from('partner_kyc_documents').delete().eq('id', d.id)
  // reopened submissions share files: only delete the object when nothing else points at it
  const { count } = await admin.from('partner_kyc_documents').select('id', { count: 'exact', head: true }).eq('storage_path', d.storage_path)
  if (!count) await admin.storage.from(BUCKET).remove([d.storage_path])
}

async function writeHistory(admin: SupabaseClient, partnerId: string, from: string, to: string, userId: string, reason: string | null = null) {
  await admin.from('partner_kyc_status_history').insert({ partner_id: partnerId, from_status: from, to_status: to, changed_by: userId, reason })
}

async function buildState(admin: SupabaseClient, partnerId: string) {
  const { data: p, error: pe } = await admin.from('partners').select('kyc_status, kyc_approved_at').eq('id', partnerId).single()
  if (pe) throw pe
  const sub = await latestSubmission(admin, partnerId)
  const docs = sub ? await docsOf(admin, sub.id) : []
  const [hist, payout] = await Promise.all([
    admin.from('partner_kyc_status_history').select('from_status, to_status, reason, created_at')
      .eq('partner_id', partnerId).order('created_at', { ascending: false }).limit(10),
    admin.from('partner_bank_accounts').select('id, bank_name, account_number, account_name, is_verified')
      .eq('partner_id', partnerId).eq('is_active', true).order('created_at', { ascending: false }),
  ])
  if (hist.error) throw hist.error
  if (payout.error) throw payout.error

  const status = p.kyc_status as string
  const isDraft = sub?.status === 'draft'
  const reviewable = ['resubmission_required', 'rejected'].includes(status)
  return {
    kyc_status: status,
    kyc_approved_at: p.kyc_approved_at,
    catalog: catalog(),
    mode: isDraft || (!sub && status === 'not_started') ? 'edit' : 'locked',
    can_reopen: !!sub && !isDraft && reviewable,
    can_withdraw: status === 'submitted' && sub?.status === 'submitted',
    review_note: reviewable
      ? (sub?.rejection_reason ?? hist.data?.find((h) => h.reason && ['rejected', 'resubmission_required'].includes(h.to_status))?.reason ?? null)
      : null,
    submission: publicSubmission(sub),
    documents: docs.map(({ storage_path: _p, ...d }) => d),
    progress: evaluate(sub, docs),
    history: hist.data ?? [],
    payout_accounts: (payout.data ?? []).map((a) => ({ ...a, account_number: `******${String(a.account_number).slice(-4)}` })),
  }
}

async function requireDraft(admin: SupabaseClient, partner: { id: string; kyc_status: string }) {
  const sub = await latestSubmission(admin, partner.id)
  if (sub?.status === 'draft') return sub
  if (sub && ['rejected', 'resubmission_required'].includes(partner.kyc_status)) {
    throw new HttpError(409, 'Choose "Update details" to edit your submission')
  }
  throw new HttpError(409, 'This submission can no longer be edited')
}

async function pruneDocs(admin: SupabaseClient, submissionId: string, entity: keyof typeof REQUIREMENTS) {
  const allowed = new Set(REQUIREMENTS[entity].docs.map((d) => d.type))
  for (const d of (await docsOf(admin, submissionId)).filter((x) => !allowed.has(x.document_type))) await removeDoc(admin, d)
}

function docRule(entity: string | null, type: string) {
  const rule = entity ? REQUIREMENTS[entity as keyof typeof REQUIREMENTS]?.docs.find((d) => d.type === type) : null
  if (!entity) throw new HttpError(422, 'Choose an account type first')
  if (!rule) throw new HttpError(422, 'That document is not needed for your account type')
}

// ---- handler -------------------------------------------------------------------
Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { user, partner, admin } = await requirePartner(req)
  const body = await readJson(req)
  const action = String(body.action ?? 'get')
  const state = async () => reply(cors, await buildState(admin, partner.id))

  switch (action) {
    case 'get':
      return state()

    case 'save': {
      const profile = body.profile && typeof body.profile === 'object' ? body.profile : {}
      const latest = await latestSubmission(admin, partner.id)

      if (!latest) {
        if (partner.kyc_status !== 'not_started') {
          throw new HttpError(409, 'Your verification is already in progress. Contact support to make changes.')
        }
        const patch = validateProfile(profile, null)
        if (!patch.entity_type) throw new HttpError(422, 'Choose an account type', { field: 'entity_type' })
        const { error } = await admin.from('partner_kyc_submissions')
          .insert({ ...patch, partner_id: partner.id, submission_number: 1, status: 'draft' })
        if (error) throw error
      } else {
        const draft = await requireDraft(admin, partner)
        const patch = validateProfile(profile, draft)
        if (Object.keys(patch).length) {
          const { error } = await admin.from('partner_kyc_submissions').update(patch).eq('id', draft.id).eq('partner_id', partner.id)
          if (error) throw error
        }
        if (patch.entity_type && patch.entity_type !== draft.entity_type) await pruneDocs(admin, draft.id, patch.entity_type)
      }
      return state()
    }

    case 'reopen': {
      const latest = await latestSubmission(admin, partner.id)
      if (!latest || latest.status === 'draft' || !['resubmission_required', 'rejected'].includes(partner.kyc_status)) {
        throw new HttpError(409, 'There is nothing to reopen')
      }
      const copy = Object.fromEntries(COPY_FIELDS.map((k) => [k, latest[k]]))
      const { data: created, error } = await admin.from('partner_kyc_submissions')
        .insert({ ...copy, partner_id: partner.id, submission_number: latest.submission_number + 1, status: 'draft' })
        .select('id').single()
      if (error) throw error
      const old = await docsOf(admin, latest.id)
      if (old.length) {
        const { error: ce } = await admin.from('partner_kyc_documents').insert(old.map((d) => ({
          kyc_submission_id: created.id, document_type: d.document_type, storage_path: d.storage_path,
          file_name: d.file_name, mime_type: d.mime_type, verified: false,
        })))
        if (ce) throw ce
      }
      return state()
    }

    case 'withdraw': {
      const latest = await latestSubmission(admin, partner.id)
      if (partner.kyc_status !== 'submitted' || latest?.status !== 'submitted') {
        throw new HttpError(409, 'Only a submission that has not been picked up for review can be withdrawn')
      }
      await admin.from('partner_kyc_submissions').update({ status: 'draft' }).eq('id', latest.id)
      await admin.from('partners').update({ kyc_status: 'not_started', updated_at: new Date().toISOString() }).eq('id', partner.id)
      await writeHistory(admin, partner.id, 'submitted', 'not_started', user.id, 'Withdrawn by partner for editing')
      return state()
    }

    case 'document_upload_url': {
      const draft = await requireDraft(admin, partner)
      const type = String(body.document_type ?? '')
      docRule(draft.entity_type, type)
      const ext = ALLOWED_MIME[String(body.mime_type ?? '')]
      if (!ext) throw new HttpError(422, 'Upload a PDF, JPG or PNG file')
      const size = Number(body.size)
      if (!(size > 0) || size > MAX_DOC_BYTES) throw new HttpError(422, 'Files must be 5MB or smaller')
      const existing = (await docsOf(admin, draft.id)).filter((d) => d.document_type === type)
      if (existing.length >= MAX_DOCS_PER_TYPE) throw new HttpError(409, `You can upload up to ${MAX_DOCS_PER_TYPE} files for this document`)

      const path = `${partner.id}/${draft.id}/${type}/${crypto.randomUUID()}.${ext}`
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error || !data) throw error ?? new Error('Could not create an upload URL')
      return reply(cors, { path, token: data.token, signed_url: data.signedUrl })
    }

    case 'document_add': {
      const draft = await requireDraft(admin, partner)
      const type = String(body.document_type ?? '')
      docRule(draft.entity_type, type)
      const path = String(body.path ?? '')
      const prefix = `${partner.id}/${draft.id}/${type}/`
      const fileName = path.slice(prefix.length)
      if (!path.startsWith(prefix) || !/^[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(fileName)) throw new HttpError(422, 'Invalid file path')

      const { data: listed, error: le } = await admin.storage.from(BUCKET).list(prefix.slice(0, -1), { search: fileName })
      if (le) throw le
      const obj = listed?.find((o) => o.name === fileName)
      if (!obj) throw new HttpError(422, 'We could not find your upload. Please try again.')

      const existing = await docsOf(admin, draft.id)
      if (existing.some((d) => d.storage_path === path)) return state() // idempotent
      if (existing.filter((d) => d.document_type === type).length >= MAX_DOCS_PER_TYPE) throw new HttpError(409, 'Too many files for this document')

      const original = String(body.file_name ?? fileName).replace(/[^\w.\- ()]/g, '_').slice(0, 150)
      const { error } = await admin.from('partner_kyc_documents').insert({
        kyc_submission_id: draft.id, document_type: type, storage_path: path, file_name: original,
        mime_type: (obj as any).metadata?.mimetype ?? null,
      })
      if (error) throw error
      return state()
    }

    case 'document_delete': {
      const draft = await requireDraft(admin, partner)
      const { data: doc, error } = await admin.from('partner_kyc_documents').select('id, storage_path')
        .eq('id', String(body.document_id ?? '')).eq('kyc_submission_id', draft.id).maybeSingle()
      if (error) throw error
      if (!doc) throw new HttpError(404, 'Document not found')
      await removeDoc(admin, doc)
      return state()
    }

    case 'document_url': {
      const { data: doc, error } = await admin
        .from('partner_kyc_documents')
        .select('id, storage_path, partner_kyc_submissions!inner(partner_id)')
        .eq('id', String(body.document_id ?? ''))
        .eq('partner_kyc_submissions.partner_id', partner.id)
        .maybeSingle()
      if (error) throw error
      if (!doc) throw new HttpError(404, 'Document not found')
      const { data, error: se } = await admin.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60)
      if (se || !data) throw se ?? new Error('Could not create a link')
      return reply(cors, { url: data.signedUrl })
    }

    case 'submit': {
      const draft = await requireDraft(admin, partner)
      const ev = evaluate(draft, await docsOf(admin, draft.id))
      if (!ev.complete) throw new HttpError(422, 'Complete all required details and documents before submitting', ev)

      const { error } = await admin.from('partner_kyc_submissions').update({ status: 'submitted' }).eq('id', draft.id).eq('partner_id', partner.id)
      if (error) throw error
      await admin.from('partners').update({ kyc_status: 'submitted', updated_at: new Date().toISOString() }).eq('id', partner.id)
      await writeHistory(admin, partner.id, partner.kyc_status, 'submitted', user.id)
      return state()
    }

    default:
      throw new HttpError(422, 'Unknown action')
  }
}))
