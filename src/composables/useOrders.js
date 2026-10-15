import { ref, computed, watch, onMounted } from 'vue'
import { ordersService } from '@/services/ordersService'

export function useOrders() {
  const orders = ref([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref(null)

  const search = ref('')
  const status = ref('all')
  const days = ref(30)

  const page = ref(1)
  const pageSize = ref(20)

  const selectedOrder = ref(null)
  const drawerOpen = ref(false)

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(total.value / pageSize.value)),
  )

  const filteredOrders = computed(() => {
    const query = search.value.trim().toLowerCase()

    return orders.value.filter((order) => {
      const tx = order.transaction ?? {}

      const matchesStatus =
        status.value === 'all' ||
        String(tx.status ?? '').toLowerCase() ===
          status.value.toLowerCase()

      const matchesSearch =
        !query ||
        [
          tx.reference,
          tx.customer_name,
          tx.customer_email,
          order.event?.event_name,
          order.ticket_type?.name,
        ].some((value) =>
          String(value ?? '').toLowerCase().includes(query),
        )

      return matchesStatus && matchesSearch
    })
  })

  async function refresh() {
    loading.value = true
    error.value = null

    try {
      const response = await ordersService.list({
        days: days.value,
        limit: pageSize.value,
        offset: (page.value - 1) * pageSize.value,
      })

      // Support Axios responses and directly returned payloads.
      let payload = response?.data ?? response

      // Unwrap the Edge Function's { success, data } response.
      if (payload?.success === true) {
        payload = payload.data
      } else if (payload?.data && !payload?.orders) {
        payload = payload.data
      }

      orders.value = Array.isArray(payload?.orders)
        ? payload.orders
        : []

      total.value = Number(
        payload?.pagination?.total ??
          payload?.total ??
          orders.value.length,
      )
    } catch (err) {
      error.value =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Unable to load orders.'

      orders.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  function setPage(value) {
    const nextPage = Number(value)

    if (
      !Number.isInteger(nextPage) ||
      nextPage < 1 ||
      nextPage > totalPages.value ||
      loading.value
    ) {
      return
    }

    page.value = nextPage
    refresh()
  }

  function openOrder(order) {
    selectedOrder.value = order
    drawerOpen.value = true
  }

  function closeOrder() {
    drawerOpen.value = false
    selectedOrder.value = null
  }

  // Reset pagination when the date range changes.
  watch(days, () => {
    page.value = 1
    refresh()
  })

  onMounted(refresh)

  return {
    orders,
    total,
    loading,
    error,
    search,
    status,
    days,
    page,
    pageSize,
    totalPages,
    filteredOrders,
    selectedOrder,
    drawerOpen,
    refresh,
    setPage,
    openOrder,
    closeOrder,
  }
}