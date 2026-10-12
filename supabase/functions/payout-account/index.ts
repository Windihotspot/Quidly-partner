// payout-account: bank list, name enquiry, save NGN payout account, get current account.
// POST { action: 'banks' | 'resolve' | 'save' | 'get', bank_slug?, account_number? }
// Banks come from public.banks.
// Real mode: the account name is resolved server-side via the gateway.
// Mock mode (PAYOUT_RESOLVE_MODE=mock): the account name is the user's email. Dev only.
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { resolveAccount } from '../_shared/gateway.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// Anything other than exactly "mock" keeps real name enquiry on.
const MOCK_RESOLVE = Deno.env.get('PAYOUT_RESOLVE_MODE') === 'mock'
if (MOCK_RESOLVE) console.warn('payout-account: MOCK name resolution is ON, do not use in production')

const bankQuery = (admin: SupabaseClient) =>
  admin.from('banks').select('name, slug, code').eq('country', 'NG').eq('is_active', true).eq('payout_eligible', true)

async function findBank(admin: SupabaseClient, body: Record<string, any>) {
  let q = bankQuery(admin)
  if (body.bank_slug) q = q.eq('slug', String(body.bank_slug).toLowerCase())
  else if (body.bank_code) q = q.eq('code', String(body.bank_code)) // legacy clients
  else throw new HttpError(422, 'Select a bank')
  const { data, error } = await q.order('name').limit(1)
  if (error) throw error
  if (!data?.length) throw new HttpError(422, 'Select a valid bank')
  return data[0] as { name: string; slug: string; code: string }
}

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { user, partner, admin } = await requirePartner(req)
  const body = await readJson(req)
  const action = String(body.action ?? 'get')

  if (action === 'banks') {
    const { data, error } = await bankQuery(admin).order('name')
    if (error) throw error
    return reply(cors, { banks: (data ?? []).map((b) => ({ name: b.name, slug: b.slug })) }, 200, {
      'Cache-Control': 'private, max-age=3600',
    })
  }

  if (action === 'get') {
    const { data, error } = await admin
      .from('partner_bank_accounts')
      .select('id, bank_name, bank_code, account_number, account_name, is_verified, verified_at')
      .eq('partner_id', partner.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (error) throw error
    return reply(cors, { accounts: data ?? [] })
  }

  if (action !== 'resolve' && action !== 'save') throw new HttpError(422, 'Unknown action')

  const accountNumber = String(body.account_number ?? '').trim()
  if (!/^\d{10}$/.test(accountNumber)) throw new HttpError(422, 'Account number must be 10 digits')
  const bank = await findBank(admin, body)

  // Mock mode skips the gateway and uses the logged-in user's email as the account name
  const resolved = MOCK_RESOLVE
    ? { account_name: partner.contact_name, account_number: accountNumber }
    : await resolveAccount(bank.code, accountNumber)

  if (action === 'resolve') return reply(cors, { account_name: resolved.account_name, bank_name: bank.name })

  // save: idempotent for the same active account
  const { data: same } = await admin
    .from('partner_bank_accounts')
    .select('id')
    .eq('partner_id', partner.id)
    .eq('bank_code', bank.code)
    .eq('account_number', accountNumber)
    .eq('is_active', true)
    .maybeSingle()
  if (same) return reply(cors, { account_id: same.id, account_name: resolved.account_name, bank_name: bank.name })

  const { error: deactivateErr } = await admin
    .from('partner_bank_accounts')
    .update({ is_active: false })
    .eq('partner_id', partner.id)
    .eq('is_active', true)
  if (deactivateErr) throw deactivateErr

  const { data, error } = await admin
    .from('partner_bank_accounts')
    .insert({
      partner_id: partner.id,
      bank_name: bank.name,
      bank_code: bank.code,
      account_number: accountNumber,
      account_name: resolved.account_name,
      is_verified: true,
      verification_method: MOCK_RESOLVE ? 'manual' : 'name_enquiry', // lets you find mock accounts later
      verified_at: new Date().toISOString(),
      is_active: true,
    })
    .select('id')
    .single()
  if (error) throw error

  return reply(cors, { account_id: data.id, account_name: resolved.account_name, bank_name: bank.name }, 201)
}))