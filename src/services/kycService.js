// src/services/kycService.js
import ApiService from '@/services/api'
import { supabase } from '@/services/supabase'

const call = (action, payload = {}) => ApiService.post('/kyc-manage', { action, ...payload })

export const kycService = {
  get: () => call('get'),
  save: (profile) => call('save', { profile }),
  reopen: () => call('reopen'),
  withdraw: () => call('withdraw'),
  submit: () => call('submit'),
  deleteDocument: (documentId) => call('document_delete', { document_id: documentId }),

  // short-lived signed link, opened in a new tab
  async viewDocument(documentId) {
    const { url } = await call('document_url', { document_id: documentId })
    window.open(url, '_blank', 'noopener')
  },

  // 1) server validates + signs  2) browser uploads straight to private storage  3) server registers the file
  async uploadDocument(file, documentType) {
    const meta = await call('document_upload_url', {
      document_type: documentType, file_name: file.name, mime_type: file.type, size: file.size,
    })
    const { error } = await supabase.storage
      .from('kyc-documents')
      .uploadToSignedUrl(meta.path, meta.token, file, { contentType: file.type })
    if (error) throw error
    return call('document_add', { document_type: documentType, path: meta.path, file_name: file.name })
  },
}

export const KYC_ID_TYPES = [
  { value: 'nin', title: 'National ID (NIN slip or card)' },
  { value: 'passport', title: 'International passport' },
  { value: 'drivers_license', title: "Driver's licence" },
  { value: 'voters_card', title: "Voter's card (PVC)" },
]
export const KYC_ENTITY_ICONS = {
  individual: 'mdi-account-outline',
  business_name: 'mdi-storefront-outline',
  limited_company: 'mdi-domain',
  incorporated_trustees: 'mdi-hand-heart-outline',
}
