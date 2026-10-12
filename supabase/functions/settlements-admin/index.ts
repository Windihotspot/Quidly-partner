// settlements-admin: run settlements and manage payouts. NOT for partners.
// Auth: a logged-in admin (partners.role = 'admin') OR, for action "run" only, header x-cron-secret.
// Deploy with --no-verify-jwt (the cron job has no JWT; this function authenticates itself).
//
// POST { action: 'run', dry_run?: boolean, partner_id?: uuid }
//      { action: 'list', status?: string }
//      { action: 'mark_paid', settlement_id, payout_reference }   // you paid it by bank transfer
//      { action: 'retry_payout', settlement_id }                  // gateway mode only
//      { action: 'cancel', settlement_id, reason }                // releases the sales for the next run
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { requireAdmin, safeEqual } from '../_shared/admin.ts'
import { loadPolicy, initiatePayout, publicSettlement } from '../_shared/settlements.ts'

const MAX_PARTNERS_PER_RUN = 200

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const body = await readJson(req)
  const action = String(body.action ?? '')

  const secret = Deno.env.get('SETTLEMENT_CRON_SECRET')
  const cronOk = !!secret && safeEqual(req.headers.get('x-cron-secret') ?? '', secret)

  let admin = getAdminClient()
  let actor = 'cron'
  if (!(action === 'run' && cronOk)) {
    const ctx = await requireAdmin(req)
    admin = ctx.admin
    actor = ctx.partner.id
  }
  console.log(`settlements-admin: ${action} by ${actor}`)

  const loadSettlement = async () => {
    const { data, error } = await admin.from('settlements').select('*').eq('id', String(body.settlement_id ?? '')).maybeSingle()
    if (error) throw error
    if (!data) throw new HttpError(404, 'Settlement not found')
    return data
  }

  // ---- run ----------------------------------------------------------------------------
  if (action === 'run') {
    const policy = loadPolicy()
    if (policy.fee_percent === null) throw new HttpError(500, 'PLATFORM_FEE_PERCENT is not configured. Set it before running settlements.')
    const dry = body.dry_run === true
    const cutoff = new Date(Date.now() - policy.hold_days * 86_400_000).toISOString()

    const { data: cands, error: ce } = await admin.rpc('settlement_candidate_partners', { p_cutoff: cutoff })
    if (ce) throw ce
    let ids: string[] = (cands ?? []).map((r: any) => r.partner_id)
    if (body.partner_id) ids = ids.filter((i) => i === body.partner_id)
    const truncated = ids.length > MAX_PARTNERS_PER_RUN
    ids = ids.slice(0, MAX_PARTNERS_PER_RUN)

    const { data: partners, error: pe } = ids.length
      ? await admin.from('partners').select('id, status, kyc_status, platform_fee_percent').in('id', ids)
      : { data: [], error: null }
    if (pe) throw pe
    const byId = new Map((partners ?? []).map((p: any) => [p.id, p]))

    const results: Array<Record<string, unknown>> = []
    for (const id of ids) {
      const p: any = byId.get(id)
      if (!p) { results.push({ partner_id: id, created: false, reason: 'partner_not_found' }); continue }
      if (p.status === 'suspended') { results.push({ partner_id: id, created: false, reason: 'partner_suspended' }); continue }
      if (policy.require_kyc && p.kyc_status !== 'approved') { results.push({ partner_id: id, created: false, reason: 'kyc_not_approved' }); continue }

      const { data: r, error } = await admin.rpc('create_settlement', {
        p_partner_id: id,
        p_cutoff: cutoff,
        p_fee_percent: p.platform_fee_percent == null ? policy.fee_percent : Number(p.platform_fee_percent),
        p_fee_flat: policy.fee_flat,
        p_min_payout: policy.min_payout,
        p_after_event: policy.release === 'after_event',
        p_dry_run: dry,
      })
      if (error) { results.push({ partner_id: id, created: false, reason: 'error', message: error.message }); continue }

      const entry: Record<string, unknown> = { partner_id: id, ...r }
      if (r.created && policy.payout_mode === 'gateway') {
        const { data: s } = await admin.from('settlements').select('*').eq('id', r.settlement_id).single()
        entry.payout = await initiatePayout(admin, s)
      }
      results.push(entry)
    }

    return reply(cors, {
      dry_run: dry, cutoff, truncated,
      policy: { hold_days: policy.hold_days, release: policy.release, min_payout: policy.min_payout, payout_mode: policy.payout_mode, fee_percent: policy.fee_percent, fee_flat: policy.fee_flat },
      created: results.filter((r) => r.created).length,
      results,
    })
  }

  // ---- list (all partners) ------------------------------------------------------------------
  if (action === 'list') {
    let q = admin.from('settlements').select('*, partners(business_name)').order('created_at', { ascending: false }).limit(100)
    if (body.status) q = q.eq('status', String(body.status))
    const { data, error } = await q
    if (error) throw error
    return reply(cors, {
      settlements: (data ?? []).map((s: any) => ({ ...publicSettlement(s, true), partner: s.partners?.business_name ?? null, partner_id: s.partner_id })),
    })
  }

  // ---- mark_paid: you sent the money yourself ---------------------------------------------------
  if (action === 'mark_paid') {
    const s = await loadSettlement()
    const ref = String(body.payout_reference ?? '').trim()
    if (!ref || ref.length > 100) throw new HttpError(422, 'payout_reference (your bank transfer reference) is required')
    if (!['pending', 'processing', 'failed'].includes(s.status)) throw new HttpError(409, `A ${s.status} settlement cannot be marked paid`)
    const { error } = await admin.from('settlements').update({
      status: 'paid', payout_method: 'manual', payout_reference: ref, paid_at: new Date().toISOString(), failure_reason: null,
    }).eq('id', s.id)
    if (error) throw error
    return reply(cors, { settlement: publicSettlement(await loadSettlement(), true) })
  }

  // ---- retry_payout ----------------------------------------------------------------------------------
  if (action === 'retry_payout') {
    if (loadPolicy().payout_mode !== 'gateway') throw new HttpError(409, 'Gateway payouts are not enabled (SETTLEMENT_PAYOUT_MODE=gateway)')
    const s = await loadSettlement()
    if (!['pending', 'failed'].includes(s.status)) throw new HttpError(409, `A ${s.status} settlement cannot be retried`)
    const result = await initiatePayout(admin, s)
    return reply(cors, { result, settlement: publicSettlement(await loadSettlement(), true) })
  }

  // ---- cancel: put the sales back in the partner's balance -------------------------------------------------
  if (action === 'cancel') {
    const s = await loadSettlement()
    if (!['pending', 'failed'].includes(s.status)) throw new HttpError(409, `A ${s.status} settlement cannot be cancelled`)
    if (s.gateway_transfer_code && s.status !== 'failed') {
      throw new HttpError(409, 'A transfer exists at the gateway. Finalise or reject it there first.')
    }
    const reason = String(body.reason ?? '').trim().slice(0, 300)
    if (!reason) throw new HttpError(422, 'reason is required')
    const { error: te } = await admin.from('transactions').update({ settlement_id: null, platform_fee: null }).eq('settlement_id', s.id)
    if (te) throw te
    const { error } = await admin.from('settlements').update({ status: 'cancelled', failure_reason: reason }).eq('id', s.id)
    if (error) throw error
    return reply(cors, { settlement: publicSettlement(await loadSettlement(), true) })
  }

  throw new HttpError(422, 'Unknown action')
}))
