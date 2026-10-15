
// partner-orders-full
// Returns a partner's transactions/orders and all related records.
//
// GET  /functions/v1/partner-orders-full?limit=50&offset=0&days=30
// POST /functions/v1/partner-orders-full
//      { "limit": 50, "offset": 0, "days": 30 }
//
// Omit days or pass null for all-time results.

import {
  handle,
  reply,
  readJson,
  requireMethod,
} from '../_shared/http.ts'

import { requirePartner } from '../_shared/auth.ts'

Deno.serve(handle(async (req, cors) => {
  requireMethod(req, 'GET', 'POST')

  const { partner, admin } = await requirePartner(req)

  const body = req.method === 'POST'
    ? await readJson(req)
    : {}

  const params = new URL(req.url).searchParams

  const rawLimit = body.limit ?? params.get('limit')
  const rawOffset = body.offset ?? params.get('offset')
  const rawDays = body.days ?? params.get('days')

  const limitValue = Number(rawLimit ?? 50)
  const offsetValue = Number(rawOffset ?? 0)

  const limit = Number.isInteger(limitValue)
    ? Math.min(Math.max(limitValue, 1), 100)
    : 50

  const offset = Number.isInteger(offsetValue)
    ? Math.max(offsetValue, 0)
    : 0

  const daysValue = rawDays == null || rawDays === ''
    ? null
    : Number(rawDays)

  if (
    daysValue !== null &&
    (!Number.isInteger(daysValue) || daysValue < 1 || daysValue > 3650)
  ) {
    return reply(cors, {
      success: false,
      message: 'days must be between 1 and 3650, or null for all time',
    }, 400)
  }

  const since = daysValue
    ? new Date(Date.now() - daysValue * 86_400_000).toISOString()
    : null

  const { data, error } = await admin.rpc('partner_orders_full', {
    p_partner_id: partner.id,
    p_since: since,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('partner-orders-full RPC failed:', error.message)

    return reply(cors, {
      success: false,
      message: 'Failed to fetch orders',
    }, 500)
  }

  return reply(cors, {
    success: true,
    period_days: daysValue,
    data: data ?? {
      orders: [],
      pagination: {
        limit,
        offset,
        total: 0,
      },
    },
  }, 200)
}))