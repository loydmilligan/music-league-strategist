import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  emailVerified: boolean
  createdAt?: number
}

interface AuthState {
  // State
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  _hasHydrated: boolean

  // Actions
  setUser: (user: User | null) => void
  setTokens: (accessToken: string | null, refreshToken: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setHasHydrated: (hasHydrated: boolean) => void
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<boolean>
  verifyEmail: (token: string) => Promise<{ success: boolean; message?: string }>
  resendVerification: (email: string) => Promise<{ success: boolean; message?: string }>
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string }>
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; message?: string }>
  validateResetToken: (token: string) => Promise<{ valid: boolean; message?: string }>
  fetchCurrentUser: () => Promise<void>
  clearAuth: () => void
}

const API_BASE = '/api/ml/auth'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          const data = await response.json()

          if (!response.ok) {
            set({ isLoading: false, error: data.error || 'Login failed' })
            return false
          }

          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          return true
        } catch {
          set({ isLoading: false, error: 'Network error. Please try again.' })
          return false
        }
      },

      register: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          const data = await response.json()

          if (!response.ok) {
            set({ isLoading: false, error: data.error || 'Registration failed' })
            return { success: false, message: data.error }
          }

          set({ isLoading: false, error: null })
          return { success: true, message: data.message }
        } catch {
          set({ isLoading: false, error: 'Network error. Please try again.' })
          return { success: false, message: 'Network error. Please try again.' }
        }
      },

      logout: async () => {
        const { accessToken, refreshToken } = get()
        set({ isLoading: true })

        try {
          if (accessToken) {
            await fetch(`${API_BASE}/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ refreshToken }),
            })
          }
        } catch {
          // Ignore logout errors, still clear local state
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false

        try {
          const response = await fetch(`${API_BASE}/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          })

          if (!response.ok) {
            // Refresh token invalid, clear auth
            get().clearAuth()
            return false
          }

          const data = await response.json()
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
          })
          return true
        } catch {
          return false
        }
      },

      verifyEmail: async (token) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`${API_BASE}/verify-email/${token}`)
          const data = await response.json()

          set({ isLoading: false })

          if (!response.ok) {
            return { success: false, message: data.error }
          }

          return { success: true, message: data.message }
        } catch {
          set({ isLoading: false })
          return { success: false, message: 'Network error. Please try again.' }
        }
      },

      resendVerification: async (email) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`${API_BASE}/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          const data = await response.json()

          set({ isLoading: false })
          return { success: response.ok, message: data.message || data.error }
        } catch {
          set({ isLoading: false })
          return { success: false, message: 'Network error. Please try again.' }
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`${API_BASE}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          const data = await response.json()

          set({ isLoading: false })
          return { success: response.ok, message: data.message || data.error }
        } catch {
          set({ isLoading: false })
          return { success: false, message: 'Network error. Please try again.' }
        }
      },

      resetPassword: async (token, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`${API_BASE}/reset-password/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
          })
          const data = await response.json()

          set({ isLoading: false })

          if (!response.ok) {
            return { success: false, message: data.error }
          }

          return { success: true, message: data.message }
        } catch {
          set({ isLoading: false })
          return { success: false, message: 'Network error. Please try again.' }
        }
      },

      validateResetToken: async (token) => {
        try {
          const response = await fetch(`${API_BASE}/reset-password/${token}`)
          const data = await response.json()

          if (!response.ok || !data.valid) {
            return { valid: false, message: data.error || 'Invalid or expired token' }
          }

          return { valid: true }
        } catch {
          return { valid: false, message: 'Network error. Please try again.' }
        }
      },

      fetchCurrentUser: async () => {
        const { accessToken } = get()
        if (!accessToken) return

        try {
          const response = await fetch(`${API_BASE}/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          })

          if (!response.ok) {
            // Token might be expired, try refresh
            const refreshed = await get().refreshAccessToken()
            if (!refreshed) {
              get().clearAuth()
            }
            return
          }

          const user = await response.json()
          set({ user, isAuthenticated: true })
        } catch {
          // Network error, don't clear auth
        }
      },

      clearAuth: () => set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        error: null,
      }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

// Helper function to wait for auth store hydration
export const waitForAuthHydration = (): Promise<void> => {
  return new Promise((resolve) => {
    // If already hydrated, resolve immediately
    if (useAuthStore.getState()._hasHydrated) {
      resolve()
      return
    }
    // Otherwise wait for hydration
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state._hasHydrated) {
        unsubscribe()
        resolve()
      }
    })
  })
}

// Helper function to get auth header for API calls
export const getAuthHeader = (): Record<string, string> => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    return { 'Authorization': `Bearer ${accessToken}` }
  }
  return {}
}

// Helper to make authenticated API calls with auto-refresh
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const { accessToken, refreshAccessToken, clearAuth } = useAuthStore.getState()

  const makeRequest = async (token: string | null) => {
    const headers: Record<string, string> = {
      ...options.headers as Record<string, string>,
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return fetch(url, { ...options, headers })
  }

  let response = await makeRequest(accessToken)

  // If unauthorized, try to refresh token
  if (response.status === 401 || response.status === 403) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      const newToken = useAuthStore.getState().accessToken
      response = await makeRequest(newToken)
    } else {
      clearAuth()
    }
  }

  return response
}
