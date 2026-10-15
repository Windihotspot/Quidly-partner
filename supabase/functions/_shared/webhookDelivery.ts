// _shared/webhookDelivery.ts  (NOT webhooks.ts: that file already exports queuePartnerWebhook)
// Webhook URL safety, secret generation, signing and delivery.
// Your existing webhook dispatcher should import signPayload()/deliver() from here
// so what partners verify is exactly what we send.
import { HttpError } from './http.ts'

export const WEBHOOK_EVENTS = [
  // keep in sync with the event_type values queuePartnerWebhook() actually writes
  { value: 'ticket.purchased', label: 'Ticket purchased' },
  { value: 'ticket.checked_in', label: 'Ticket checked in' },
]
export const isWebhookEvent = (v: unknown) => WEBHOOK_EVENTS.some((e) => e.value === v)

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export const newSecret = () => 'whsec_' + hex(crypto.getRandomValues(new Uint8Array(32)).buffer)

export async function signPayload(secret: string, timestamp: number, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`)))
}

function isPrivateV4(ip: string) {
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
}

/** https only, public domain names only, and every resolved IPv4 must be public (SSRF guard). */
export async function assertSafeWebhookUrl(raw: string): Promise<string> {
  const bad = (m: string): never => { throw new HttpError(422, m, { field: 'url' }) }
  let u: URL
  try { u = new URL(raw) } catch { return bad('Enter a valid URL, e.g. https://example.com/webhooks/quidly') }
  if (u.protocol !== 'https:') bad('The URL must start with https://')
  if (u.username || u.password) bad('Remove the username and password from the URL')
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) {
    bad('Use a public domain name (no IP addresses or localhost)')
  }
  let ips: string[] = []
  try { ips = await Deno.resolveDns(host, 'A') } catch { bad('We could not find that domain. Check the spelling.') }
  if (ips.some(isPrivateV4)) bad('That domain points to a private network address')
  return u.toString()
}

export async function deliver(url: string, secret: string, eventId: string, type: string, data: unknown) {
  const ts = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({ id: eventId, type, created: ts, data })
  const sig = await signPayload(secret, ts, body)
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Quidly-Webhooks/1.0', 'X-Quidly-Signature': `t=${ts},v1=${sig}` },
      body,
    })
    return { ok: res.status >= 200 && res.status < 300, status: res.status, ms: Date.now() - started, error: null as string | null }
  } catch (e) {
    const timeout = (e as Error).name === 'TimeoutError'
    return { ok: false, status: 0, ms: Date.now() - started, error: timeout ? 'Your server did not respond within 8 seconds' : 'We could not reach your server' }
  }
}