import { ref, computed } from 'vue'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export interface APIKey {
  id: string
  partner_id: string
  key_prefix: string
  key_hash: string
  environment: 'test' | 'live'
  status: 'active' | 'revoked'
  scopes: string[]
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
  revoked_reason: string | null
}

export function usePartnerAPIKeys(partnerId: string) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref(false)

  // Check if partner can create API keys (KYC approved + has verified bank account)
  const canCreateAPIKey = async (): Promise<{
    allowed: boolean
    reason?: string
  }> => {
    try {
      // Get partner KYC status
      const { data: partner, error: partnerError } = await supabase
        .from('partners')
        .select('kyc_status')
        .eq('id', partnerId)
        .single()

      if (partnerError) throw partnerError

      if (partner.kyc_status !== 'approved') {
        return {
          allowed: false,
          reason: 'Your KYC verification has not been approved yet. Please complete the verification process.',
        }
      }

      // Check if has verified bank account
      const { data: bankAccounts, error: bankError } = await supabase
        .from('partner_bank_accounts')
        .select('id')
        .eq('partner_id', partnerId)
        .eq('is_verified', true)
        .eq('is_active', true)
        .limit(1)

      if (bankError) throw bankError

      if (!bankAccounts || bankAccounts.length === 0) {
        return {
          allowed: false,
          reason: 'You need to add and verify a bank account before generating API keys.',
        }
      }

      return { allowed: true }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to check API key permissions'
      return { allowed: false, reason: error.value }
    }
  }

  // Generate new API key
  const generateAPIKey = async (
    environment: 'test' | 'live',
    scopes: string[] = ['widget:create_transaction']
  ): Promise<{ fullKey: string; keyData: APIKey } | null> => {
    loading.value = true
    error.value = null
    success.value = false

    try {
      // Check if allowed
      const { allowed, reason } = await canCreateAPIKey()
      if (!allowed) {
        error.value = reason
        return null
      }

      // Generate a random key
      const keyPart1 = Math.random().toString(36).substring(2, 15).toUpperCase()
      const keyPart2 = Math.random().toString(36).substring(2, 15).toUpperCase()
      const fullKey = `qk_${environment}_${keyPart1}_${keyPart2}`
      const keyPrefix = `qk_${environment}_${keyPart1.substring(0, 8)}`

      // Hash the key for storage
      const encoder = new TextEncoder()
      const data = encoder.encode(fullKey)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // Store in database
      const { data: apiKey, error: insertError } = await supabase
        .from('api_keys')
        .insert([
          {
            partner_id: partnerId,
            key_prefix: keyPrefix,
            key_hash: keyHash,
            environment,
            status: 'active',
            scopes,
          },
        ])
        .select()
        .single()

      if (insertError) throw insertError

      success.value = true
      return {
        fullKey,
        keyData: apiKey,
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to generate API key'
      return null
    } finally {
      loading.value = false
    }
  }

  // Fetch active API keys
  const fetchAPIKeys = async () => {
    loading.value = true
    error.value = null

    try {
      const { data, error: queryError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      return (data || []) as APIKey[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch API keys'
      return []
    } finally {
      loading.value = false
    }
  }

  // Revoke API key
  const revokeAPIKey = async (keyId: string, reason?: string) => {
    loading.value = true
    error.value = null
    success.value = false

    try {
      const { error: updateError } = await supabase
        .from('api_keys')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_reason: reason,
        })
        .eq('id', keyId)
        .eq('partner_id', partnerId)

      if (updateError) throw updateError

      success.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to revoke API key'
    } finally {
      loading.value = false
    }
  }

  // Log API key usage
  const logAPIKeyUsage = async (keyId: string) => {
    try {
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyId)
    } catch (err) {
      console.error('Failed to log API key usage:', err)
    }
  }

  return {
    loading,
    error,
    success,
    canCreateAPIKey,
    generateAPIKey,
    fetchAPIKeys,
    revokeAPIKey,
    logAPIKeyUsage,
  }
}