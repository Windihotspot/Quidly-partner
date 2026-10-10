// payout-account: bank list, name enquiry, save NGN payout account, get current account.
// POST { action: 'banks' | 'resolve' | 'save' | 'get', bank_code?, account_number? }
// The account name is ALWAYS resolved server-side; the client value is never trusted.
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { listBanks, resolveAccount } from '../_shared/gateway.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { partner, admin } = await requirePartner(req)
  const body = await readJson(req)
  const action = String(body.action ?? 'get')

  if (action === 'banks') return reply(cors, { banks: await listBanks() })

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

  const bankCode = String(body.bank_code ?? '')
  const accountNumber = String(body.account_number ?? '').trim()
  if (!/^\d{10}$/.test(accountNumber)) throw new HttpError(422, 'Account number must be 10 digits')
  const bank = (await listBanks()).find((b) => b.code === bankCode)
  if (!bank) throw new HttpError(422, 'Select a valid bank')

  const resolved = await resolveAccount(bank.code, accountNumber)
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
      verification_method: 'name_enquiry',
      verified_at: new Date().toISOString(),
      is_active: true,
    })
    .select('id')
    .single()
  if (error) throw error

  return reply(cors, { account_id: data.id, account_name: resolved.account_name, bank_name: bank.name }, 201)
}))
