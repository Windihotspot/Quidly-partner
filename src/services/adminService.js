import ApiService from '@/services/api'

const call = (fn, action, p = {}) => ApiService.post(`/${fn}`, { action, ...p })

export const adminService = {
  overview: () => ApiService.post('/admin-overview', {}),

  partners: {
    list: (p) => call('admin-partners', 'list', p),
    get: (partner_id) => call('admin-partners', 'get', { partner_id }),
    setStatus: (partner_id, status, reason) => call('admin-partners', 'set_status', { partner_id, status, reason }),
    setFee: (partner_id, platform_fee_percent) => call('admin-partners', 'set_fee', { partner_id, platform_fee_percent }),
  },
  kyc: {
    queue: (p) => call('admin-kyc', 'queue', p),
    get: (partner_id) => call('admin-kyc', 'get', { partner_id }),
    verifyDocument: (document_id, verified) => call('admin-kyc', 'verify_document', { document_id, verified }),
    review: (submission_id, decision, reason) => call('admin-kyc', 'review', { submission_id, decision, reason }),
  },
  transactions: {
    list: (p) => call('admin-transactions', 'list', p),
    get: (id) => call('admin-transactions', 'get', { id }),
  },
  events: {
    list: (p) => call('admin-events', 'list', p),
    setStatus: (event_id, status, reason) => call('admin-events', 'set_status', { event_id, status, reason }),
  },
  banks: {
    list: () => call('admin-banks', 'list'),
    upsert: (bank) => call('admin-banks', 'upsert', bank),
  },
  ops: {
    keys: (p) => call('admin-ops', 'keys_list', p),
    revokeKey: (id, reason) => call('admin-ops', 'key_revoke', { id, reason }),
    webhooks: (p) => call('admin-ops', 'webhooks_list', p),
    retryWebhook: (id) => call('admin-ops', 'webhook_retry', { id }),
    audit: (p) => call('admin-ops', 'audit_list', p),
  },
  users: {
    list: () => call('admin-users', 'list'),
    add: (email) => call('admin-users', 'add', { email }),
    setActive: (user_id, is_active) => call('admin-users', 'set_active', { user_id, is_active }),
  },
}