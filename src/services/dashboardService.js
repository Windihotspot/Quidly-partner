// src/services/dashboardService.js
import ApiService from '@/services/api'

export const dashboardService = {
  // days: 7 | 30 | 90 | null (all time)
  overview: (days = null) => ApiService.post('/dashboard-overview', { days }),
}
