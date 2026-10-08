// src/stores/authStore.js
import { defineStore } from 'pinia'
import { supabase } from '@/services/supabase'
import ApiService from '@/services/api'

const SESSION_KEY = 'quidly_partner_session'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    partner: JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'),
    loading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.partner,
  },

  actions: {
    async login(email, password) {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error) throw error
        if (!data.user) throw new Error('Login failed.')

        const { data: partner, error: partnerError } = await supabase
          .from('partners')
          .select('*')
          .eq('auth_user_id', data.user.id)
          .single()

        if (partnerError || !partner) {
          throw new Error('Could not load your partner profile.')
        }

        this.partner = partner
        localStorage.setItem(SESSION_KEY, JSON.stringify(partner))
        return partner
      } catch (err) {
        this.error = err.message || 'Incorrect email or password.'
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
          password: form.password,
        })
        return result
      } catch (err) {
        this.error = err.response?.data?.error || err.message || 'Registration failed.'
        throw err
      } finally {
        this.loading = false
      }
    },

    async logout() {
      await supabase.auth.signOut()
      this.partner = null
      localStorage.removeItem(SESSION_KEY)
    },

    async fetchSession() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return

      const { data: partner } = await supabase
        .from('partners')
        .select('*')
        .eq('auth_user_id', data.session.user.id)
        .single()

      if (partner) {
        this.partner = partner
        localStorage.setItem(SESSION_KEY, JSON.stringify(partner))
      }
    },
  },
})