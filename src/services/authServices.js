import ApiService from '../services/api.ts'

/**
 * Register a new partner
 */
export const authService = {
  async signup(payload) {
    try {
      const response = await ApiService.post('/register', payload)
      console.log(response)
    } catch (error) {
      const message = error.response?.data?.error || error.response?.data?.message || error.message

      throw new Error(message)
    }
  },

  async login(payload) {
    try {
      const response = await ApiService.post('/login', payload)
      console.log(response)
      console.log(payload)
      return response
    } catch (error) {
      const message = error.response?.data?.error || error.response?.data?.message || error.message

      throw new Error(message)
    }
  },

  //   logout() {
  //     localStorage.removeItem('token')    window.location.href = '/login'
  //   },

  getToken() {
    return localStorage.getItem('token')
  },

  isAuthenticated() {
    return !!localStorage.getItem('token')
  }
}
