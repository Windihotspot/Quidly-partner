<template>
  <div class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-white">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-white bg-opacity-20 rounded-lg">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 7H7v6h6V7z" />
            </svg>
          </div>
          <div>
            <p class="font-mono text-sm">{{ apiKey.key_prefix }}...****</p>
            <p class="text-xs opacity-90">{{ apiKey.environment }} environment</p>
          </div>
        </div>

        <div class="flex items-center gap-2 px-3 py-1 bg-white bg-opacity-20 rounded-full">
          <span class="w-2 h-2 bg-green-300 rounded-full"></span>
          <span class="text-xs font-medium">Active</span>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-4">
      <!-- Details Grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Created</p>
          <p class="text-sm font-medium text-gray-900">{{ formatDate(apiKey.created_at) }}</p>
        </div>

        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Scopes</p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="scope in apiKey.scopes"
              :key="scope"
              class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded"
            >
              {{ formatScope(scope) }}
            </span>
          </div>
        </div>

        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Last Used</p>
          <p class="text-sm font-medium text-gray-900">
            {{ apiKey.last_used_at ? formatDate(apiKey.last_used_at) : 'Never' }}
          </p>
        </div>
      </div>

      <!-- Security Info -->
      <div class="bg-blue-50 rounded-lg p-3 border border-blue-200">
        <p class="text-xs text-blue-900 font-medium mb-2">Security</p>
        <ul class="text-xs text-blue-800 space-y-1">
          <li class="flex items-center gap-2">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span>{{ apiKey.environment === 'test' ? 'Testing mode - No real transactions' : 'Production mode - Real transactions' }}</span>
          </li>
          <li class="flex items-center gap-2">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span>Rotated regularly for security</span>
          </li>
        </ul>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 pt-2 border-t">
        <v-btn
          size="small"
          variant="text"
          color="error"
          @click="$emit('revoke', apiKey.id)"
          :loading="loading"
          class="flex-1"
        >
          <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          Revoke
        </v-btn>

        <v-btn
          size="small"
          variant="text"
          external
          href="https://docs.quidly.com/api"
        >
          <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM15.657 14.243a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM11 17a1 1 0 102 0v-1a1 1 0 10-2 0v1zM5.757 15.657a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zM5.757 4.343a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707z" />
          </svg>
          Docs
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface APIKey {
  id: string
  partner_id: string
  key_prefix: string
  key_hash: string
  environment: 'test' | 'live'
  status: 'active' | 'revoked'
  scopes: string[]
  last_used_at: string | null
  created_at: string
}

interface Props {
  apiKey: APIKey
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

defineEmits<{
  revoke: [keyId: string]
}>()

const formatDate = (date: string) => {
  const dateObj = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - dateObj.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return dateObj.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatScope = (scope: string) => {
  const scopeMap: Record<string, string> = {
    'widget:create_transaction': 'Transactions',
    'widget:read_transactions': 'Read Transactions',
    'webhook:events': 'Webhooks',
  }
  return scopeMap[scope] || scope
}
</script>