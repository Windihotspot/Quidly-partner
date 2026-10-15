// _shared/ticketPdf.ts: one A4 page per ticket, customised per event (banner, theme colour, details).
// pdf-lib's built-in fonts are WinAnsi only: accents are stripped and unsupported characters become "?".
// (Embed a TTF via @pdf-lib/fontkit if you need full Unicode.)
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import { qrPng, fmtDate, fmtTimeRange, venueText } from './tickets.ts'

export type PdfTicket = { reference: string; token: string; holder: string; typeName: string; groupSize: number | null }
type PdfInput = { event: Record<string, any>; organizer: string; orderRef: string; tickets: PdfTicket[] }

const THEME_ACCENTS: Record<string, string> = { midnight: '#38bdf8' } // align with THEMES in src/lib/eventHelpers.js
const DEFAULT_ACCENT = '#2b7fff'
const hexRgb = (h: string) => { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255) }
const safe = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/₦/g, 'N').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')

function wrap(text: string, font: any, size: number, maxW: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of safe(text).split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(t, size) <= maxW) line = t
    else { if (line) out.push(line); line = w }
  }
  if (line) out.push(line)
  return out
}

// only fetch banners from our own public storage (the URL is partner-controlled: avoid SSRF)
async function loadBanner(pdf: PDFDocument, url?: string | null) {
  const prefix = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/event-images/`
  if (!url || !url.startsWith(prefix)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const b = new Uint8Array(await res.arrayBuffer())
    if (b.length > 4_000_000) return null
    return b[0] === 0x89 && b[1] === 0x50 ? await pdf.embedPng(b) : await pdf.embedJpg(b)
  } catch { return null }
}

export async function buildTicketPdf({ event, organizer, orderRef, tickets }: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(safe(`${event.event_name} tickets`))
  pdf.setProducer('Quidly')
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const reg = await pdf.embedFont(StandardFonts.Helvetica)
  const mono = await pdf.embedFont(StandardFonts.CourierBold)
  const banner = await loadBanner(pdf, event.banner_url)

  const W = 595.28, H = 841.89, M = 48
  const accent = hexRgb(THEME_ACCENTS[event.theme] ?? DEFAULT_ACCENT)
  const dark = rgb(0.07, 0.09, 0.15), grey = rgb(0.42, 0.45, 0.5), line = rgb(0.88, 0.9, 0.92)
  const tz = event.timezone || 'Africa/Lagos'
  const details = [fmtDate(event.starts_at, tz), fmtTimeRange(event.starts_at, event.ends_at, tz), venueText(event)].filter(Boolean)

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i]
    const page = pdf.addPage([W, H])
    page.drawRectangle({ x: 0, y: H - 16, width: W, height: 16, color: accent })

    let top = H - 58
    page.drawText('E-TICKET', { x: M, y: top, size: 10, font: bold, color: grey })
    const count = safe(`Ticket ${i + 1} of ${tickets.length}`)
    page.drawText(count, { x: W - M - reg.widthOfTextAtSize(count, 10), y: top, size: 10, font: reg, color: grey })
    top -= 20

    let bw = 0, bh = 0
    if (banner) {
      const s = Math.min(150 / banner.width, 190 / banner.height)
      bw = banner.width * s; bh = banner.height * s
      page.drawImage(banner, { x: M, y: top - bh, width: bw, height: bh })
    }
    const tx = M + (banner ? bw + 22 : 0)
    const maxW = W - M - tx
    let y = top - 20
    for (const l of wrap(event.event_name, bold, 22, maxW)) { page.drawText(l, { x: tx, y, size: 22, font: bold, color: dark }); y -= 27 }
    y -= 6
    for (const d of details) for (const l of wrap(d, reg, 11.5, maxW)) { page.drawText(l, { x: tx, y, size: 11.5, font: reg, color: dark }); y -= 16 }
    if (organizer) { y -= 4; page.drawText(safe(`Organised by ${organizer}`), { x: tx, y, size: 10, font: reg, color: grey }); y -= 14 }

    // ticket card
    const cardTop = Math.min(y, top - bh) - 30
    const cardH = 280
    page.drawRectangle({ x: M, y: cardTop - cardH, width: W - 2 * M, height: cardH, borderColor: line, borderWidth: 1 })
    page.drawRectangle({ x: M, y: cardTop - 4, width: W - 2 * M, height: 4, color: accent })

    const lx = M + 24
    let fy = cardTop - 40
    const field = (label: string, value: string) => {
      page.drawText(safe(label), { x: lx, y: fy, size: 8.5, font: bold, color: grey })
      fy -= 17
      for (const l of wrap(value, bold, 15, 235)) { page.drawText(l, { x: lx, y: fy, size: 15, font: bold, color: dark }); fy -= 19 }
      fy -= 14
    }
    field('TICKET TYPE', t.typeName)
    field('HOLDER', t.holder)
    if (t.groupSize && t.groupSize > 1) field('ADMITS', `${t.groupSize} people`)
    field('ORDER', orderRef)

    const qrSize = 200
    const qx = W - M - 24 - qrSize, qy = cardTop - cardH + 52
    page.drawImage(await pdf.embedPng(await qrPng(t.token, 640)), { x: qx, y: qy, width: qrSize, height: qrSize })
    const ref = safe(t.reference)
    page.drawText(ref, { x: qx + (qrSize - mono.widthOfTextAtSize(ref, 12)) / 2, y: qy - 20, size: 12, font: mono, color: dark })

    const notes = ['Show this QR code at the entrance. It can be scanned from your phone or a printout.',
      'Each ticket admits one entry. A ticket that has already been scanned will be refused.', 'Do not share this ticket or post the QR code publicly.']
    let ny = cardTop - cardH - 32
    for (const n of notes) { page.drawText(safe(n), { x: M, y: ny, size: 9.5, font: reg, color: grey }); ny -= 14 }
    page.drawText('Powered by Quidly', { x: M, y: 36, size: 9, font: reg, color: grey })
  }
  return await pdf.save()
}