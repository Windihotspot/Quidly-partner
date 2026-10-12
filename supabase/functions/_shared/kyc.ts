// _shared/kyc.ts
// Single source of truth for Nigerian KYC rules: who needs what, field validation, masking.
// The frontend renders from catalog(), so changing a rule here changes the UI too.
import { HttpError } from './http.ts'

export const BUCKET = 'kyc-documents'
export const MAX_DOC_BYTES = 5 * 1024 * 1024
export const MAX_DOCS_PER_TYPE = 3
export const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

export const NG_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River',
  'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna',
  'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

export const ENTITY_TYPES = ['individual', 'business_name', 'limited_company', 'incorporated_trustees'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]
export const ID_TYPES = ['nin', 'passport', 'drivers_license', 'voters_card']

export const DOC_CATALOG: Record<string, { label: string; hint: string }> = {
  cac_certificate: { label: 'CAC certificate', hint: 'Certificate of incorporation or business name registration from the CAC.' },
  cac_status_report: { label: 'CAC status report', hint: 'Shows your current directors or proprietors. Download it from the CAC portal.' },
  memorandum_of_association: { label: 'Memorandum & Articles of Association', hint: 'The MEMART as filed with the CAC.' },
  constitution: { label: 'Constitution or trust deed', hint: 'Your governing document as filed with the CAC.' },
  tin_certificate: { label: 'TIN certificate', hint: 'Tax Identification Number certificate from FIRS or your state revenue service.' },
  valid_id: { label: 'Valid government ID', hint: "NIN slip or card, international passport, driver's licence or voter's card. It must match the ID details you enter." },
  proof_of_address: { label: 'Proof of address', hint: 'Utility bill, tenancy agreement or bank statement dated within the last 3 months.' },
  selfie: { label: 'Passport photograph', hint: 'A clear, recent, front-facing photo. No hat or sunglasses.' },
  bank_statement: { label: 'Bank statement', hint: 'Your last 3 months, from the account you want to be paid into.' },
}

type Requirement = {
  label: string
  description: string
  registration: { label: string; prefix: string } | null
  tin: 'required' | 'optional' | 'none'
  docs: Array<{ type: string; required: boolean }>
}

export const REQUIREMENTS: Record<EntityType, Requirement> = {
  individual: {
    label: 'Individual (not registered)',
    description: 'For organisers without a CAC registration: freelancers, promoters and community groups run by one person.',
    registration: null,
    tin: 'none',
    docs: [
      { type: 'valid_id', required: true },
      { type: 'proof_of_address', required: true },
      { type: 'selfie', required: true },
      { type: 'bank_statement', required: false },
    ],
  },
  business_name: {
    label: 'Registered business name (BN)',
    description: 'A sole proprietorship or partnership registered with the CAC.',
    registration: { label: 'CAC business name number (BN)', prefix: 'BN' },
    tin: 'required',
    docs: [
      { type: 'cac_certificate', required: true },
      { type: 'cac_status_report', required: false },
      { type: 'valid_id', required: true },
      { type: 'proof_of_address', required: true },
      { type: 'tin_certificate', required: false },
      { type: 'bank_statement', required: false },
    ],
  },
  limited_company: {
    label: 'Limited company (RC)',
    description: 'A company limited by shares or by guarantee, registered with the CAC.',
    registration: { label: 'CAC registration number (RC)', prefix: 'RC' },
    tin: 'required',
    docs: [
      { type: 'cac_certificate', required: true },
      { type: 'cac_status_report', required: true },
      { type: 'memorandum_of_association', required: true },
      { type: 'valid_id', required: true },
      { type: 'proof_of_address', required: true },
      { type: 'tin_certificate', required: false },
      { type: 'bank_statement', required: false },
    ],
  },
  incorporated_trustees: {
    label: 'Incorporated trustees (IT)',
    description: 'Churches, NGOs, associations and clubs registered with the CAC.',
    registration: { label: 'CAC incorporated trustees number (IT)', prefix: 'IT' },
    tin: 'optional',
    docs: [
      { type: 'cac_certificate', required: true },
      { type: 'constitution', required: true },
      { type: 'valid_id', required: true },
      { type: 'proof_of_address', required: true },
      { type: 'tin_certificate', required: false },
    ],
  },
}

export function catalog() {
  return {
    entity_types: ENTITY_TYPES.map((key) => {
      const r = REQUIREMENTS[key]
      return {
        key,
        label: r.label,
        description: r.description,
        registration: r.registration,
        tin: r.tin,
        documents: r.docs.map((d) => ({ ...d, ...DOC_CATALOG[d.type] })),
      }
    }),
    states: NG_STATES,
  }
}

// ---- completeness ------------------------------------------------------------
const FIELD_LABELS: Record<string, string> = {
  legal_business_name: 'Registered name',
  business_registration_number: 'CAC registration number',
  tax_identification_number: 'TIN',
  business_address: 'Address',
  business_city: 'City',
  business_state: 'State',
  director_full_name: 'Director / owner full name',
  director_dob: 'Date of birth',
  director_nin: 'NIN',
  director_bvn: 'BVN',
  director_id_type: 'ID type',
  director_id_number: 'ID number',
}

export function requiredFields(entity: EntityType): string[] {
  const r = REQUIREMENTS[entity]
  const fields = ['legal_business_name', 'business_address', 'business_city', 'business_state',
    'director_dob', 'director_bvn', 'director_nin', 'director_id_type', 'director_id_number']
  if (entity !== 'individual') fields.push('director_full_name')
  if (r.registration) fields.push('business_registration_number')
  if (r.tin === 'required') fields.push('tax_identification_number')
  return fields
}

export function evaluate(sub: Record<string, any> | null, docs: Array<{ document_type: string }>) {
  const entity = sub?.entity_type as EntityType | undefined
  if (!entity || !REQUIREMENTS[entity]) {
    return { steps: { type: false, details: false, documents: false }, complete: false, missing_fields: [], missing_docs: [] }
  }
  const missing_fields = requiredFields(entity)
    .filter((k) => !sub![k])
    .map((k) => ({ field: k, label: k === 'legal_business_name' && entity === 'individual' ? 'Full legal name' : FIELD_LABELS[k] }))
  const have = new Set(docs.map((d) => d.document_type))
  const missing_docs = REQUIREMENTS[entity].docs
    .filter((d) => d.required && !have.has(d.type))
    .map((d) => ({ type: d.type, label: DOC_CATALOG[d.type].label }))
  return {
    steps: { type: true, details: missing_fields.length === 0, documents: missing_docs.length === 0 },
    complete: missing_fields.length === 0 && missing_docs.length === 0,
    missing_fields,
    missing_docs,
  }
}

// ---- masking (BVN / NIN / ID numbers never leave the server in full) -----------
export const MASK_RE = /^\*+[A-Za-z0-9]{4}$/
export const isMasked = (v: unknown) => typeof v === 'string' && MASK_RE.test(v)
export function mask(v?: string | null): string | null {
  if (!v) return null
  return v.length <= 4 ? '*'.repeat(v.length) : '*'.repeat(v.length - 4) + v.slice(-4)
}

const PUBLIC_FIELDS = ['id', 'submission_number', 'status', 'entity_type', 'legal_business_name', 'trading_name',
  'business_registration_number', 'tax_identification_number', 'business_address', 'business_city', 'business_state',
  'director_full_name', 'director_dob', 'director_id_type', 'rejection_reason', 'reviewed_at', 'created_at']

export function publicSubmission(sub: Record<string, any> | null) {
  if (!sub) return null
  const out: Record<string, any> = {}
  for (const k of PUBLIC_FIELDS) out[k] = sub[k] ?? null
  out.director_bvn = mask(sub.director_bvn)
  out.director_nin = mask(sub.director_nin)
  out.director_id_number = mask(sub.director_id_number)
  return out
}

// ---- validation ---------------------------------------------------------------
const NAME_RE = /^[\p{L}][\p{L}\s'.-]*$/u
const ID_RULES: Record<string, { re: RegExp; message: string }> = {
  nin: { re: /^\d{11}$/, message: 'NIN must be exactly 11 digits' },
  passport: { re: /^[A-Z]\d{8}$/, message: 'Passport number looks like A12345678' },
  drivers_license: { re: /^[A-Z0-9]{8,20}$/, message: "Enter your driver's licence number (letters and digits only)" },
  voters_card: { re: /^[A-Z0-9]{9,22}$/, message: 'Enter the 19-character VIN on your voter\'s card' },
}

const fail = (field: string, message: string): never => {
  throw new HttpError(422, message, { field })
}

/**
 * Validates only the keys present in `input` and returns a DB patch.
 * Masked values (e.g. ******1234) mean "unchanged" and are skipped.
 */
export function validateProfile(input: Record<string, any>, existing: Record<string, any> | null) {
  const patch: Record<string, any> = {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k)
  const text = (k: string, max: number, label: string, min = 0): string | null => {
    const v = String(input[k] ?? '').trim().replace(/\s+/g, ' ')
    if (!v) return null
    if (v.length < min || v.length > max) fail(k, `${label} must be ${min ? `${min} to ` : 'at most '}${max} characters`)
    return v
  }

  if (has('entity_type')) {
    if (!ENTITY_TYPES.includes(input.entity_type)) fail('entity_type', 'Choose an account type')
    patch.entity_type = input.entity_type
  }
  const entity: EntityType | undefined = patch.entity_type ?? existing?.entity_type

  if (has('legal_business_name')) {
    const v = text('legal_business_name', 150, 'Name', 2)
    if (v && entity === 'individual' && !NAME_RE.test(v)) fail('legal_business_name', 'Use your name exactly as it appears on your ID')
    patch.legal_business_name = v
  }
  if (has('trading_name')) patch.trading_name = text('trading_name', 100, 'Display name', 2)
  if (has('business_address')) patch.business_address = text('business_address', 250, 'Address', 10)
  if (has('business_city')) patch.business_city = text('business_city', 80, 'City', 2)
  if (has('business_state')) {
    const v = text('business_state', 40, 'State')
    if (v && !NG_STATES.includes(v)) fail('business_state', 'Select a valid state')
    patch.business_state = v
  }
  if (has('director_full_name')) {
    const v = text('director_full_name', 120, 'Name', 2)
    if (v && !NAME_RE.test(v)) fail('director_full_name', 'Use your name exactly as it appears on your ID')
    patch.director_full_name = v
  }

  if (has('director_dob')) {
    const raw = String(input.director_dob ?? '').trim()
    if (!raw) patch.director_dob = null
    else {
      const d = new Date(`${raw}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(d.getTime())) fail('director_dob', 'Enter a valid date of birth')
      const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000)
      if (age < 18) fail('director_dob', 'You must be at least 18 years old')
      if (age > 100) fail('director_dob', 'Enter a valid date of birth')
      patch.director_dob = raw
    }
  }

  for (const [k, label] of [['director_bvn', 'BVN'], ['director_nin', 'NIN']] as const) {
    if (!has(k)) continue
    const v = String(input[k] ?? '').replace(/\s/g, '')
    if (isMasked(v)) continue
    if (!v) { patch[k] = null; continue }
    if (!/^\d{11}$/.test(v)) fail(k, `${label} must be exactly 11 digits`)
    patch[k] = v
  }

  if (has('director_id_type')) {
    if (input.director_id_type && !ID_TYPES.includes(input.director_id_type)) fail('director_id_type', 'Select a valid ID type')
    patch.director_id_type = input.director_id_type || null
    // a number for a different ID type is meaningless: clear it unless a new one was sent
    if (patch.director_id_type !== existing?.director_id_type && !has('director_id_number')) patch.director_id_number = null
  }
  if (has('director_id_number')) {
    const v = String(input.director_id_number ?? '').replace(/\s/g, '').toUpperCase()
    if (!isMasked(v)) {
      if (!v) patch.director_id_number = null
      else {
        const type = patch.director_id_type ?? existing?.director_id_type
        const rule = type ? ID_RULES[type] : null
        if (!type) fail('director_id_type', 'Select an ID type first')
        if (rule && !rule.re.test(v)) fail('director_id_number', rule.message)
        patch.director_id_number = v
      }
    }
  }

  const reg = entity ? REQUIREMENTS[entity]?.registration : null
  if (has('business_registration_number')) {
    const raw = String(input.business_registration_number ?? '').toUpperCase().replace(/[\s-]/g, '')
    if (!raw || !reg) patch.business_registration_number = null
    else {
      const m = raw.match(/^(RC|BN|IT)?(\d{5,9})$/)
      if (!m || (m[1] && m[1] !== reg.prefix)) fail('business_registration_number', `Enter a valid number, e.g. ${reg.prefix}1234567`)
      patch.business_registration_number = `${reg.prefix}${m![2]}`
    }
  }
  if (has('tax_identification_number')) {
    const raw = String(input.tax_identification_number ?? '').replace(/\s/g, '')
    if (!raw) patch.tax_identification_number = null
    else {
      if (!/^\d{8,14}(-\d{3,4})?$/.test(raw)) fail('tax_identification_number', 'Enter a valid TIN (8 to 14 digits)')
      patch.tax_identification_number = raw
    }
  }

  // ---- cross-field rules on the effective record ----
  const eff = { ...(existing ?? {}), ...patch }
  if (eff.entity_type === 'individual') {
    patch.business_registration_number = null
    if (eff.legal_business_name) patch.director_full_name = eff.legal_business_name // the person IS the account holder
  }
  if (eff.director_id_type === 'nin' && eff.director_nin) patch.director_id_number = eff.director_nin

  return patch
}
