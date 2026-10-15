
import ApiService from '@/services/api'

export const ordersService = {
  // Fetch paginated orders with optional filters
  list: (params = {}) => ApiService.post('/partner-orders-full', params),

  // Fetch a single order with all related details
  details: (params = {}) => ApiService.post('/partner-orders-details', params),
}
