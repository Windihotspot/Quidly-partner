
import { publicEventService } from '@/services/publicEventService'

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export async function pollPaymentStatus(
  reference,
  getQuidlyRef = () => '',
  {
    intervalMs = 3000,
    timeoutMs = 120000,
    onStatus,
  } = {},
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await publicEventService.confirmPayment(
        reference,
        getQuidlyRef(),
      )

      onStatus?.(result)

      if (
        result.status === 'completed' ||
        result.status === 'failed' ||
        result.status === 'review'
      ) {
        return result
      }
    } catch (error) {
      console.error('[checkout] status check failed', error)
    }

    const remaining = timeoutMs - (Date.now() - startedAt)

    if (remaining <= 0) break

    await sleep(Math.min(intervalMs, remaining))
  }

  return {
    status: 'pending',
    reference,
    message:
      'Your payment is taking longer than expected to confirm. You can check its status again.',
  }
}
