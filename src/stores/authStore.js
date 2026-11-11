
import { defineStore } from 'pinia'
import { supabase } from '@/services/supabase'
import ApiService from '@/services/api'

const SESSION_KEY = 'quidly_partner_session'

async function checkSuperAdmin(userId) {
  const { data, error } = await supabase
    .from('platform_admins')
    .select('user_id, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Super admin verification failed:', error)
    throw new Error('Unable to verify platform administrator access.')
  }

  return data?.role === 'super_admin'
}

async function fetchPartnerProfile(userId) {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Partner profile lookup failed:', error)
    throw error
  }

  return data
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    partner: JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'),
    isSuperAdmin: false,
    loading: false,
    initialized: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,

    isPartner: (state) => !!state.partner && !state.isSuperAdmin,

    isPlatformAdmin: (state) => state.isSuperAdmin
  },

  actions: {
    async login(email, password) {
      this.loading = true
      this.error = null

      try {
        // 1. Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        })

        if (error) throw error

        if (!data.user) {
          throw new Error('Login failed. User not found.')
        }

        const user = data.user

        // 2. Check platform administrator privileges
        const isAdmin = await checkSuperAdmin(user.id)

        // 3. Load partner profile if one exists
        let partner = null

        try {
          partner = await fetchPartnerProfile(user.id)
        } catch (partnerError) {
          // A Super Admin does not need a partner profile.
          if (!isAdmin) {
            throw new Error(
              'Unable to load your partner profile. Please contact support.'
            )
          }

          console.warn(
            'Super Admin has no partner profile. Continuing with admin access.',
            partnerError
          )
        }

        // 4. Reject users who are neither admins nor registered partners
        if (!isAdmin && !partner) {
          throw new Error(
            'No partner account or platform administrator privileges found.'
          )
        }

        // 5. Update Pinia state
        this.user = user
        this.partner = partner
        this.isSuperAdmin = isAdmin

        // 6. Persist partner profile only when available
        if (partner) {
          localStorage.setItem(
            SESSION_KEY,
            JSON.stringify(partner)
          )
        } else {
          localStorage.removeItem(SESSION_KEY)
        }

        return {
          user,
          partner,
          isSuperAdmin: isAdmin
        }

      } catch (err) {
        this.error = err.message || 'Incorrect email or password.'

        // Clear partial authentication state
        this.user = null
        this.partner = null
        this.isSuperAdmin = false

        localStorage.removeItem(SESSION_KEY)

        await supabase.auth.signOut()

        throw err

      } finally {
        this.loading = false
      }
    },

    async register(form) {
      this.loading = true
      this.error = null

      try {
        const result = await ApiService.post('/swift-function', {
          businessName: form.businessName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          businessType: form.businessType,
          password: form.password
        })

        return result

      } catch (err) {
        this.error =
          err.response?.data?.error ||
          err.message ||
          'Registration failed.'

        throw err

      } finally {
        this.loading = false
      }
    },

    async fetchSession() {
      this.loading = true

      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) throw error

        const session = data.session

        if (!session?.user) {
          this.user = null
          this.partner = null
          this.isSuperAdmin = false
          localStorage.removeItem(SESSION_KEY)
          return null
        }

        const user = session.user

        // Verify admin privileges from the database.
        const isAdmin = await checkSuperAdmin(user.id)

        let partner = null

        try {
          partner = await fetchPartnerProfile(user.id)
        } catch (err) {
          if (!isAdmin) throw err
        }

        if (!isAdmin && !partner) {
          throw new Error('Your account does not have portal access.')
        }

        this.user = user
        this.partner = partner
        this.isSuperAdmin = isAdmin

        if (partner) {
          localStorage.setItem(
            SESSION_KEY,
            JSON.stringify(partner)
          )
        } else {
          localStorage.removeItem(SESSION_KEY)
        }

        return {
          user,
          partner,
          isSuperAdmin: isAdmin
        }

      } catch (err) {
        console.error('Session initialization failed:', err)

        this.user = null
        this.partner = null
        this.isSuperAdmin = false

        localStorage.removeItem(SESSION_KEY)

        return null

      } finally {
        this.loading = false
        this.initialized = true
      }
    },

    async logout() {
      try {
        await supabase.auth.signOut()
      } finally {
        this.user = null
        this.partner = null
        this.isSuperAdmin = false
        this.error = null

        localStorage.removeItem(SESSION_KEY)
      }
    }
  }
})
