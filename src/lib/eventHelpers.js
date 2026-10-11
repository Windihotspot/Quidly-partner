// src/lib/eventHelpers.js
// Constants + date/time helpers shared by the events wizard.

export const COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Egypt', 'Morocco', 'Tanzania', 'Uganda', 'Rwanda',
  'Ethiopia', 'Senegal', "Côte d'Ivoire", 'Cameroon', 'Zambia', 'Zimbabwe', 'Botswana', 'Namibia',
  'Mauritius', 'United Kingdom', 'United States', 'Canada', 'United Arab Emirates',
]

export const TIMEZONES = [
  { value: 'Africa/Lagos', title: '(UTC+01:00) West Central Africa' },
  { value: 'Africa/Accra', title: '(UTC+00:00) Accra' },
  { value: 'Africa/Johannesburg', title: '(UTC+02:00) Johannesburg' },
  { value: 'Africa/Cairo', title: '(UTC+02:00) Cairo' },
  { value: 'Africa/Nairobi', title: '(UTC+03:00) Nairobi' },
  { value: 'Asia/Dubai', title: '(UTC+04:00) Dubai' },
  { value: 'Europe/London', title: 'London (GMT/BST)' },
  { value: 'America/New_York', title: 'New York (Eastern)' },
  { value: 'America/Los_Angeles', title: 'Los Angeles (Pacific)' },
]

export const EVENT_FORMATS = [
  { value: 'in_person', title: 'In-person' },
  { value: 'online', title: 'Online' },
  { value: 'hybrid', title: 'Hybrid (in-person + online)' },
]

export const CATEGORIES_PRIMARY = [
  'Democracy', 'Policy and Elections', 'Wellness', 'Visual Arts', 'Books and Literature',
  'Gender and Equality', 'Shopping', 'Easter', 'Christmas', 'Funfairs and Carnivals', 'Hiking',
  'Kayaking', 'Travel and Outdoor', 'Dance', 'Christianity', 'Ramadan', 'Eid', 'Islam', 'Podcasts',
  'Improv', 'Entrepreneurship', 'Theatre', 'Poetry and Spoken Word',
]
export const CATEGORIES_MORE = [
  'Music', 'Concerts', 'Comedy', 'Tech', 'Business', 'Networking', 'Food and Drink', 'Fashion',
  'Sports', 'Fitness', 'Education', 'Film', 'Festivals', 'Parties', 'Nightlife', 'Charity',
  'Health', 'Gaming', 'Family', 'Community', 'Workshops', 'Conferences', 'Faith', 'Art Exhibitions',
]
export const MAX_CATEGORIES = 5

export const LINEUP_TITLES = [
  'Speakers', 'Headliners', 'Artists', 'Performers', 'Special guests', 'Hosts', 'DJs', 'Sponsors',
]

export const THEMES = [
  { id: 'classic', name: 'Classic', description: 'Poster beside the event details.', bg: '#ffffff', accent: '#2b7fff', text: '#111827' },
  { id: 'minimal', name: 'Minimal', description: 'Clean and quiet, lots of white space.', bg: '#fafafa', accent: '#111827', text: '#111827' },
  { id: 'bold', name: 'Bold', description: 'High-contrast colour for lively events.', bg: '#fff7ed', accent: '#ea580c', text: '#431407' },
  { id: 'midnight', name: 'Midnight', description: 'Dark layout for nightlife and concerts.', bg: '#0f172a', accent: '#60a5fa', text: '#f8fafc' },
]

export const ORDER_LIMITS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20]

// ---- money / validation -----------------------------------------------------
export function formatNaira(n) {
  return `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export function validateImageFile(file) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Upload a JPEG or PNG image.'
  if (file.size > MAX_IMAGE_BYTES) return 'The maximum upload file size is 2MB.'
  return null
}

export function absoluteUrl(u) {
  if (!u) return ''
  return /^https?:\/\//i.test(u) ? u : `${window.location.origin}${u.startsWith('/') ? '' : '/'}${u}`
}

// ---- timezone-safe date handling -------------------------------------------
// The pickers give a local date + 12h time + AM/PM. The server wants a UTC ISO
// string, computed in the EVENT's timezone (not the browser's).

function tzOffsetMs(utcMs, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs
}

export const TIME_RE = /^(0?[1-9]|1[0-2]):[0-5]\d$/

export function zonedToUtcISO(date, time, ampm, tz) {
  const [h, m] = time.split(':').map(Number)
  const hour24 = (h % 12) + (ampm === 'PM' ? 12 : 0)
  const guess = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour24, m)
  const off1 = tzOffsetMs(guess, tz)
  let utc = guess - off1
  const off2 = tzOffsetMs(utc, tz)
  if (off2 !== off1) utc = guess - off2
  return new Date(utc).toISOString()
}

export function isoToZoned(iso, tz) {
  if (!iso) return { date: null, time: '', ampm: 'AM' }
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  const p = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  const hour = +p.hour
  return {
    date: new Date(+p.year, +p.month - 1, +p.day),
    time: `${String(hour % 12 || 12).padStart(2, '0')}:${p.minute}`,
    ampm: hour >= 12 ? 'PM' : 'AM',
  }
}

// ---- display formatting ----------------------------------------------------
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function formatLongDate(iso, tz = 'Africa/Lagos') {
  if (!iso) return ''
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  )
  return `${p.weekday}, ${p.month} ${ordinal(+p.day)} ${p.year}`
}

export function formatTimeRange(startIso, endIso, tz = 'Africa/Lagos') {
  if (!startIso || !endIso) return ''
  const t = (iso, withZone) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
      ...(withZone ? { timeZoneName: 'short' } : {}),
    }).format(new Date(iso))
  return `${t(startIso)} - ${t(endIso, true)}`
}

export function formatShortDate(iso, tz = 'Africa/Lagos') {
  if (!iso) return 'No date yet'
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz })
}
