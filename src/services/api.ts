
import axios from 'axios'
import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios'
import { supabase } from '@/services/supabase'

const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json'
  }
})

/* ---------------- LOGGING HELPERS ---------------- */

const logRequest = (config: InternalAxiosRequestConfig) => {
  console.groupCollapsed(
    `🚀 API REQUEST: ${config.method?.toUpperCase()} ${config.baseURL ?? ''}${config.url ?? ''}`
  )

  console.log('Method:', config.method?.toUpperCase())
  console.log('URL:', `${config.baseURL ?? ''}${config.url ?? ''}`)
  console.log('Params:', config.params ?? null)
  console.log('Headers:', { ...config.headers })
  console.log('Request Data:', config.data ?? null)

  console.groupEnd()
}

const logResponse = (response: AxiosResponse) => {
  console.groupCollapsed(
    `✅ API RESPONSE: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`
  )

  console.log('Status:', response.status)
  console.log('Status Text:', response.statusText)
  console.log('URL:', response.config.url)
  console.log('Method:', response.config.method?.toUpperCase())
  console.log('Response Headers:', response.headers)
  console.log('Response Data:', response.data)

  console.groupEnd()
}

const logError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    console.groupCollapsed(
      `❌ API ERROR: ${error.config?.method?.toUpperCase() ?? 'UNKNOWN'} ${error.config?.url ?? ''}`
    )

    console.error('Message:', error.message)
    console.error('URL:', error.config?.url)
    console.error('Method:', error.config?.method?.toUpperCase())
    console.error('Request Data:', error.config?.data ?? null)
    console.error('Status:', error.response?.status ?? 'No HTTP response')
    console.error('Response Data:', error.response?.data ?? null)
    console.error('Response Headers:', error.response?.headers ?? null)

    if (error.code) {
      console.error('Error Code:', error.code)
    }

    console.error('Full Error:', error)
    console.groupEnd()
  } else {
    console.error('❌ Unexpected API Error:', error)
  }
}

/* ---------------- REQUEST INTERCEPTOR ---------------- */

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('❌ Failed to retrieve Supabase session:', error)
      }

      const token = data.session?.access_token

      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`)
      }
    } catch (err) {
      console.error('❌ Error getting Supabase session:', err)
    }

    logRequest(config)

    return config
  },
  (error: unknown) => {
    logError(error)
    return Promise.reject(error)
  }
)

/* ---------------- RESPONSE INTERCEPTOR ---------------- */

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    logResponse(response)
    return response
  },
  async (error: unknown) => {
    logError(error)

    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.warn('⚠️ Received 401 Unauthorized. Signing out of Supabase.')

      try {
        const { error: signOutError } = await supabase.auth.signOut()

        if (signOutError) {
          console.error('❌ Supabase sign-out failed:', signOutError)
        }
      } catch (signOutError) {
        console.error('❌ Error during Supabase sign-out:', signOutError)
      }
    }

    return Promise.reject(error)
  }
)

/* ---------------- API METHODS ---------------- */

const ApiService = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.get<T>(url, config).then((res) => res.data)
  },

  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return apiClient.post<T>(url, data, config).then((res) => res.data)
  },

  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return apiClient.put<T>(url, data, config).then((res) => res.data)
  },

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return apiClient.patch<T>(url, data, config).then((res) => res.data)
  },

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.delete<T>(url, config).then((res) => res.data)
  },

  upload<T = unknown>(url: string, payload: FormData): Promise<T> {
    return apiClient
      .post<T>(url, payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then((res) => res.data)
  }
}

export default ApiService
