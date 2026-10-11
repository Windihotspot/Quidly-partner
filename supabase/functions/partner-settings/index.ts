// partner-settings: everything the partner Settings page needs.
// POST { action, ... } where action is one of:
//   get | update_profile | update_preferences | update_webhook | rotate_webhook_secret
//   test_webhook | webhook_events | retry_webhook_event | change_password | sign_out_others | audit_logs
// Payout accounts are NOT handled here: the page reuses `payout-account` (and `get` returns them masked).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { handle, reply, readJson, requireMethod, HttpError } from '../_shared/http.ts'
import { requirePartner } from '../_shared/auth.ts'
import { audit } from '../_shared/audit.ts'
import { WEBHOOK_EVENTS, isWebhookEvent, assertSafeWebhookUrl, newSecret, deliver } from '../_shared/webhooks.ts'

const TIMEZONES = ['Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Africa/Johannesburg', 'Europe/London', 'America/New_York', 'UTC']
const PREF_FLAGS = ['notify_sale_email', 'notify_sale_sms', 'notify_payout_email', 'notify_kyc_email', 'notify_webhook_failure_email', 'notify_weekly_digest']

const fail = (field: string, message: string): never => {
  throw new HttpError(422, message, { field })
}
const clean = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max)

function normalizePhone(raw: string): string | null {
  const v = raw.replace(/[\s()-]/g, '')
  if (!v) return null
  if (/^0\d{10}$/.test(v)) return `+234${v.slice(1)}`
  if (/^234\d{10}$/.test(v)) return `+${v}`
  if (/^\+\d{10,15}$/.test(v)) return v
  return fail('phone', 'Enter a valid phone number, e.g. 08012345678 or +2348012345678')
}

// ---- data helpers --------------------------------------------------------------
async function getSettings(admin: SupabaseClient, partnerId: string) {
  await admin.from('partner_settings').upsert({ partner_id: partnerId }, { onConflict: 'partner_id', ignoreDuplicates: true })
  const { data, error } = await admin.from('partner_settings').select('*').eq('partner_id', partnerId).single()
  if (error) throw error
  return data
}

async function buildState(admin: SupabaseClient, partnerId: string) {
  const [p, settings, banks] = await Promise.all([
    admin.from('partners').select('business_name, contact_name, email, phone, website, country, kyc_status, webhook_url').eq('id', partnerId).single(),
    getSettings(admin, partnerId),
    admin.from('partner_bank_accounts').select('id, bank_name, account_number, account_name, is_verified')
      .eq('partner_id', partnerId).eq('is_active', true).order('created_at', { ascending: false }),
  ])
  if (p.error) throw p.error
  if (banks.error) throw banks.error
  const d = p.data
  return {
    profile: { business_name: d.business_name, contact_name: d.contact_name, email: d.email, phone: d.phone, website: d.website, country: d.country },
    kyc_status: d.kyc_status,
    preferences: {
      timezone: settings.timezone,
      notification_email: settings.notification_email,
      ...Object.fromEntries(PREF_FLAGS.map((k) => [k, settings[k]])),
    },
    webhook: {
      url: d.webhook_url,
      events: settings.webhook_events,
      secret_last4: settings.webhook_secret_last4,
      secret_rotated_at: settings.webhook_secret_rotated_at,
    },
    payout_accounts: (banks.data ?? []).map((a) => ({ ...a, account_number: `******${String(a.account_number).slice(-4)}` })),
    catalog: { timezones: TIMEZONES, webhook_events: WEBHOOK_EVENTS },
  }
}

async function secretOf(admin: SupabaseClient, partnerId: string) {
  const { data } = await admin.from('partner_secrets').select('webhook_secret').eq('partner_id', partnerId).maybeSingle()
  return data?.webhook_secret as string | undefined
}

async function storeSecret(admin: SupabaseClient, partnerId: string, secret: string) {
  const now = new Date().toISOString()
  const a = await admin.from('partner_secrets').upsert({ partner_id: partnerId, webhook_secret: secret, updated_at: now })
  if (a.error) throw a.error
  const b = await admin.from('partner_settings').update({ webhook_secret_last4: secret.slice(-4), webhook_secret_rotated_at: now }).eq('partner_id', partnerId)
  if (b.error) throw b.error
}

// ---- handler -------------------------------------------------------------------
Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'POST')
  const { user, partner, admin } = await requirePartner(req)
  const body = await readJson(req)
  const action = String(body.action ?? 'get')
  const state = async (extra: Record<string, unknown> = {}) => reply(cors, { ...(await buildState(admin, partner.id)), ...extra })

  switch (action) {
    case 'get':
      return state()

    case 'update_profile': {
      const input = body.profile && typeof body.profile === 'object' ? body.profile : {}
      const business_name = clean(input.business_name, 120)
      const contact_name = clean(input.contact_name, 120)
      const website = clean(input.website, 255)
      if (business_name.length < 2) fail('business_name', 'Enter your business name')
      if (contact_name.length < 2) fail('contact_name', 'Enter a contact name')
      if (website && !/^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(website)) fail('website', 'Website must start with http:// or https://')
      const { error } = await admin.from('partners')
        .update({ business_name, contact_name, phone: normalizePhone(String(input.phone ?? '')), website: website || null, updated_at: new Date().toISOString() })
        .eq('id', partner.id)
      if (error) throw error
      await audit(admin, partner.id, user.id, 'profile.updated', {}, req)
      return state()
    }

    case 'update_preferences': {
      const input = body.preferences && typeof body.preferences === 'object' ? body.preferences : {}
      const timezone = clean(input.timezone, 64) || 'Africa/Lagos'
      if (!TIMEZONES.includes(timezone)) fail('timezone', 'Choose a timezone from the list')
      const email = clean(input.notification_email, 255).toLowerCase()
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('notification_email', 'Enter a valid email address')
      await getSettings(admin, partner.id)
      const patch = { timezone, notification_email: email || null, ...Object.fromEntries(PREF_FLAGS.map((k) => [k, input[k] === true])) }
      const { error } = await admin.from('partner_settings').update(patch).eq('partner_id', partner.id)
      if (error) throw error
      return state()
    }

    case 'update_webhook': {
      const raw = clean(body.url, 2048)
      const settings = await getSettings(admin, partner.id)
      let url: string | null = null
      let newSecretValue: string | null = null
      let events: string[] = settings.webhook_events
      if (raw) {
        url = await assertSafeWebhookUrl(raw)
        events = (Array.isArray(body.events) ? body.events : []).filter(isWebhookEvent)
        if (!events.length) fail('events', 'Select at least one event')
        if (!(await secretOf(admin, partner.id))) newSecretValue = newSecret() // first-time setup
      }
      const { error } = await admin.from('partners').update({ webhook_url: url, updated_at: new Date().toISOString() }).eq('id', partner.id)
      if (error) throw error
      await admin.from('partner_settings').update({ webhook_events: events }).eq('partner_id', partner.id)
      if (newSecretValue) await storeSecret(admin, partner.id, newSecretValue)
      await audit(admin, partner.id, user.id, url ? 'webhook.updated' : 'webhook.removed', { host: url ? new URL(url).host : null }, req)
      return state({ new_secret: newSecretValue }) // shown once, never returned again
    }

    case 'rotate_webhook_secret': {
      await getSettings(admin, partner.id)
      const secret = newSecret()
      await storeSecret(admin, partner.id, secret)
      await audit(admin, partner.id, user.id, 'webhook.secret_rotated', {}, req)
      return state({ new_secret: secret })
    }

    case 'test_webhook': {
      if (!partner.webhook_url) throw new HttpError(422, 'Save a webhook URL first')
      const url = await assertSafeWebhookUrl(partner.webhook_url)
      const secret = await secretOf(admin, partner.id)
      if (!secret) throw new HttpError(422, 'No signing secret yet. Rotate the secret to create one.')
      const id = crypto.randomUUID()
      const payload = { message: 'This is a test event from Quidly.' }
      const result = await deliver(url, secret, id, 'ping', payload)
      // insert with the final status so a dispatcher polling "pending" rows never double-sends it
      await admin.from('webhook_events').insert({
        id, partner_id: partner.id, event_type: 'ping', payload,
        delivery_status: result.ok ? 'delivered' : 'failed', delivered_at: result.ok ? new Date().toISOString() : null,
      })
      return reply(cors, result)
    }

    case 'webhook_events': {
      const page = Math.max(0, Number(body.page) || 0)
      const size = 15
      let q = admin.from('webhook_events')
        .select('id, event_type, delivery_status, delivered_at, retry_count, created_at, payload', { count: 'exact' })
        .eq('partner_id', partner.id).order('created_at', { ascending: false }).range(page * size, page * size + size - 1)
      if (['pending', 'delivered', 'failed'].includes(body.status)) q = q.eq('delivery_status', body.status)
      const { data, count, error } = await q
      if (error) throw error
      return reply(cors, { items: data ?? [], total: count ?? 0, page, size })
    }

    case 'retry_webhook_event': {
      if (!partner.webhook_url) throw new HttpError(422, 'No webhook URL is set')
      const url = await assertSafeWebhookUrl(partner.webhook_url)
      const secret = await secretOf(admin, partner.id)
      if (!secret) throw new HttpError(422, 'No signing secret yet')
      const { data: ev, error } = await admin.from('webhook_events').select('id, event_type, payload, retry_count')
        .eq('id', String(body.event_id ?? '')).eq('partner_id', partner.id).maybeSingle()
      if (error) throw error
      if (!ev) throw new HttpError(404, 'Event not found')
      const result = await deliver(url, secret, ev.id, ev.event_type, ev.payload)
      await admin.from('webhook_events').update({
        delivery_status: result.ok ? 'delivered' : 'failed',
        delivered_at: result.ok ? new Date().toISOString() : null,
        retry_count: (ev.retry_count ?? 0) + 1,
        ...(result.ok ? { next_retry_at: null } : {}),
      }).eq('id', ev.id)
      return reply(cors, result)
    }

    case 'change_password': {
      const current = String(body.current_password ?? '')
      const next = String(body.new_password ?? '')
      if (!current) fail('current_password', 'Enter your current password')
      if (next.length < 8 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next)) {
        fail('new_password', 'Use at least 8 characters with upper and lower case letters and a number')
      }
      if (next === current) fail('new_password', 'Choose a password you have not used here')
      // verify the current password with a throwaway anon client (no session is kept)
      const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
      const { error: bad } = await anon.auth.signInWithPassword({ email: user.email ?? partner.email, password: current })
      if (bad) fail('current_password', 'Your current password is incorrect')
      const { error } = await admin.auth.admin.updateUserById(user.id, { password: next })
      if (error) throw new HttpError(422, error.message, { field: 'new_password' })
      await admin.auth.admin.signOut(req.headers.get('Authorization')!.replace('Bearer ', ''), 'others')
      await audit(admin, partner.id, user.id, 'password.changed', {}, req)
      return reply(cors, { changed: true })
    }

    case 'sign_out_others': {
      const { error } = await admin.auth.admin.signOut(req.headers.get('Authorization')!.replace('Bearer ', ''), 'others')
      if (error) throw error
      await audit(admin, partner.id, user.id, 'sessions.signed_out_others', {}, req)
      return reply(cors, { done: true })
    }

    case 'audit_logs': {
      const { data, error } = await admin.from('partner_audit_logs').select('id, action, ip, created_at')
        .eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(15)
      if (error) throw error
      return reply(cors, { items: data ?? [] })
    }

    default:
      throw new HttpError(422, 'Unknown action')
  }
}))