const TONES = {
  green: { color: '#059669', background: '#d1fae5', borderColor: '#a7f3d0' },
  amber: { color: '#d97706', background: '#fef3c7', borderColor: '#fcd34d' },
  red: { color: '#dc2626', background: '#fee2e2', borderColor: '#fecaca' },
  gray: { color: '#6b7280', background: '#e5e7eb', borderColor: '#d1d5db' },
  blue: { color: '#2b7fff', background: '#e3f0ff', borderColor: '#bfdbfe' },
}
const PARTNER = { active: 'green', pending: 'amber', suspended: 'red', paid: 'green', processing: 'amber', failed: 'red' }
const KYC = {
  approved: 'green', submitted: 'amber', under_review: 'amber', resubmission_required: 'amber',
  rejected: 'red', suspended: 'red', not_started: 'gray',
}
const TX = { completed: 'green', pending: 'amber', processing: 'amber', failed: 'red', cancelled: 'gray' }
export const txBadge = (s) => TONES[TX[s] ?? 'gray']
export const txLabel = (s) => ({ completed: 'successful', processing: 'pending' }[s] ?? s)
export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
export const partnerBadge = (s) => TONES[PARTNER[s] ?? 'gray']
export const kycBadge = (s) => TONES[KYC[s] ?? 'gray']
export const humanize = (s) => (s ?? '').replace(/_/g, ' ')
export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
export const docLabel = (s) => {
  const t = humanize(s).replace(/\b(cac|tin|nin|bvn|id)\b/gi, (m) => m.toUpperCase())
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const EV = { published: 'green', draft: 'gray', cancelled: 'red', completed: 'blue' }
export const eventBadge = (s) => TONES[EV[s] ?? 'gray']