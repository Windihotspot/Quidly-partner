// _shared/ticketEmail.ts: ticket email through Termii's templated Email API.
// Termii only sends a template created in its dashboard, filled from `variables` (no raw HTML, no attachments).
// So the QR codes arrive as one `tickets_html` variable and the PDF as a link. See termii-ticket-email-template.html.
// Env: TERMII_API_KEY, TERMII_EMAIL_CONFIG_ID, TERMII_EMAIL_TEMPLATE_ID, TERMII_BASE_URL (default https://api.ng.termii.com)
import { HttpError } from './http.ts'
import { qrUrl, fmtDate, fmtTimeRange, venueText } from './tickets.ts'
import type { Order } from './deliverTickets.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function ticketsHtml(order: Order) {
  const n = order.tickets.length
  return order.tickets.map((t, i) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;margin:0 0 16px;">
<tr><td style="padding:16px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;">Ticket ${i + 1} of ${n} &middot; ${esc(t.typeName)}${t.groupSize && t.groupSize > 1 ? ` &middot; admits ${t.groupSize}` : ''}</p>
<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827;">${esc(t.holder)}</p>
<img src="${esc(qrUrl(t.token))}" width="200" height="200" alt="QR code for ticket ${esc(t.reference)}" style="display:block;border:0;width:200px;height:200px;">
<p style="margin:10px 0 0;font-family:'Courier New',monospace;font-size:14px;font-weight:700;color:#111827;">${esc(t.reference)}</p>
</td></tr></table>`).join('')
}

export async function sendTicketEmail(order: Order, downloadUrl: string): Promise<string | null> {
  const { tx, event } = order
  const apiKey = env('TERMII_API_KEY'), configId = env('TERMII_EMAIL_CONFIG_ID'), templateId = env('TERMII_EMAIL_TEMPLATE_ID')
  if (!apiKey || !configId || !templateId) throw new HttpError(500, 'Email is not configured')
  const tz = event.timezone || 'Africa/Lagos'

  const res = await fetch(`${env('TERMII_BASE_URL') || 'https://api.ng.termii.com'}/api/templates/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      api_key: apiKey,
      email: tx.customer_email,
      subject: `Your tickets for ${event.event_name}`.slice(0, 150),
      email_configuration_id: configId,
      template_id: templateId,
      variables: {
        customer_name: tx.customer_name,
        event_name: event.event_name,
        event_when: [fmtDate(event.starts_at, tz), fmtTimeRange(event.starts_at, event.ends_at, tz)].filter(Boolean).join(', '),
        event_venue: venueText(event),
        organizer_name: order.organizer,
        order_reference: tx.reference,
        ticket_count: String(order.tickets.length),
        tickets_html: ticketsHtml(order),
        download_url: downloadUrl,
        year: String(new Date().getFullYear()),
      },
    }),
  }).catch(() => null)
  if (!res) throw new Error('Could not reach Termii')
  const json = await res.json().catch(() => null)
  if (!res.ok || (json?.code && json.code !== 'ok')) {
    throw new Error(`Termii rejected the email (${res.status}): ${String(json?.message ?? '').slice(0, 200)}`)
  }
  return json?.message_id ? String(json.message_id) : null
}