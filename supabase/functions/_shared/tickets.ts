// _shared/tickets.ts: signed QR tokens, signed download links, QR rendering, date formatting.
// Env: TICKET_SIGNING_SECRET (>= 32 random chars). Rotating it invalidates every issued QR code and PDF link.
import QRCode from 'npm:qrcode@1.5.4'
import { HttpError } from './http.ts'

const enc = new TextEncoder()

function secret() {
  const s = Deno.env.get('TICKET_SIGNING_SECRET')
  if (!s || s.length < 32) throw new HttpError(500, 'Ticketing is not configured')
  return s
}
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function mac(label: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(`${label}:${data}`))).slice(0, 16) // 96 bits
}

export function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

// ---- QR token: QDL1.<ticket_reference>.<sig>. Forged or guessed codes fail before any DB lookup. ----
export const qrToken = async (ticketRef: string) => `QDL1.${ticketRef}.${await mac('qr', ticketRef)}`

export async function readQrToken(raw: string): Promise<string | null> {
  const s = raw.trim()
  if (!s.startsWith('QDL1.')) return null
  const i = s.lastIndexOf('.')
  if (i <= 5) return null
  const ref = s.slice(5, i)
  return safeEq(s.slice(i + 1), await mac('qr', ref)) ? ref : null
}

// ---- public links (served by ticket-files) ----
const base = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/ticket-files`
export const qrUrl = (token: string) => `${base()}?kind=qr&c=${encodeURIComponent(token)}`
export const pdfSig = (orderRef: string) => mac('pdf', orderRef)
export const pdfUrl = async (orderRef: string) => `${base()}?kind=pdf&o=${encodeURIComponent(orderRef)}&s=${await pdfSig(orderRef)}`

export async function qrPng(text: string, width = 480): Promise<Uint8Array> {
  const buf = await QRCode.toBuffer(text, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width })
  return new Uint8Array(buf)
}

// ---- formatting (event timezone) ----
export function fmtDate(iso: string | null, tz = 'Africa/Lagos') {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }).format(new Date(iso))
}
export function fmtTimeRange(start: string | null, end: string | null, tz = 'Africa/Lagos') {
  if (!start) return ''
  const f = (d: string) => new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(new Date(d))
  return end ? `${f(start)} - ${f(end)}` : f(start)
}
export function venueText(e: Record<string, any>) {
  if (e.format === 'online') return 'Online event'
  return [e.venue_name, e.address, e.country].filter(Boolean).join(', ') || 'Location to be announced'
}