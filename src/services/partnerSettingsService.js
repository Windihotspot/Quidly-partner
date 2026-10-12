// Mirrors kycService: one call per edge-function action.
import ApiService from '@/services/api'

// works whether ApiService.post resolves to the axios response or to response.data
const unwrap = (r) => r?.data ?? r
const call = async (action, params = {}) => unwrap(await ApiService.post('/partner-settings', { action, ...params }))

export const partnerSettingsService = {
  get: () => call('get'),
  updateProfile: (profile) => call('update_profile', { profile }),
  updatePreferences: (preferences) => call('update_preferences', { preferences }),
  updateWebhook: (url, events) => call('update_webhook', { url, events }), // state + { new_secret }
  rotateSecret: () => call('rotate_webhook_secret'), // state + { new_secret }
  testWebhook: () => call('test_webhook'),
  webhookEvents: (page = 0, status = '') => call('webhook_events', { page, status }),
  retryEvent: (event_id) => call('retry_webhook_event', { event_id }),
  changePassword: (current_password, new_password) => call('change_password', { current_password, new_password }),
  signOutOthers: () => call('sign_out_others'),
  auditLogs: () => call('audit_logs'),
  // payout accounts live in the existing function
  removePayout: async (account_id) => unwrap(await ApiService.post('/payout-account', { action: 'remove', account_id })),
}

// field-level message from { error, details: { field } }
export const fieldOf = (e) => e?.response?.data?.details?.field ?? null