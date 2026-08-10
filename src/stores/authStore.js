import { defineStore } from "pinia";
import { supabase } from '@/services/supabase'
// import ApiService from '../services/api.ts'

export const useAuthStore = defineStore('auth', {
  state: () => ({ 
    user: null,
    session: null,
    loading: false
  }),

  getters: {
    isAuthenticated: (state) => !!state.session
  },

  actions: {
    // 🔐 LOGIN
    async login(payload) {
      this.loading = true

      try {
        const { data, error } = await supabase.auth.signInWithPassword(payload)

        if (error) throw error
        console.log('login data:', data)
        this.user = data.user
        this.session = data.session

        return data
      } catch (err) {
        throw err
      } finally {
        this.loading = false
      }
    },

    // 🚪 LOGOUT
    async logout() {
      await supabase.auth.signOut()

      this.user = null
      this.session = null
    },

    // 🔄 GET CURRENT SESSION (on app load)
    async fetchSession() {
      const { data } = await supabase.auth.getSession()

      this.session = data.session
      this.user = data.session?.user || null
    },

    // 👂 LISTEN FOR AUTH CHANGES
    initAuthListener() {
      supabase.auth.onAuthStateChange((event, session) => {
        this.session = session
        this.user = session?.user || null
      })
    }
  }
})