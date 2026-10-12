// src/services/settlementsService.js
import ApiService from '@/services/api'

const call = (action, payload = {}) => ApiService.post('/settlements-manage', { action, ...payload })

export const settlementsService = {
  // status: 'all' | 'paid' | 'processing' | 'failed'
  overview: ({ status = 'all', limit = 20, offset = 0 } = {}) => call('overview', { status, limit, offset }),
  detail: (settlementId) => call('detail', { settlement_id: settlementId }),

  // The server builds the CSV; this just hands it to the browser as a download.
  async downloadReport(settlementId) {
    const { filename, csv } = await call('report', { settlement_id: settlementId })
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }) // BOM so Excel reads ₦ and accents correctly
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return filename
  },
}
