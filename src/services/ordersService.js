import ApiService from '@/services/api'

export const ordersService = {
  // Fetch paginated orders and all related records
  list: (params = {}) =>
    ApiService.post('/partner-orders-full', {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      days: params.days ?? 30,
    }),
}
