import { useState, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

interface SpotifyOAuthState {
  isLoading: boolean
  error: string | null
  isConfigured: boolean
}

interface SpotifyOAuthActions {
  startOAuthFlow: (useMobileRedirect?: boolean) => Promise<void>
  handleOAuthCallback: (code: string) => Promise<void>
  clearError: () => void
}

const OAUTH_STATE_KEY = 'spotify-oauth-state'
const OAUTH_REDIRECT_KEY = 'spotify-oauth-redirect'

/**
 * Detects if the user is on a mobile device or in a PWA
 */
function isMobileOrPWA(): boolean {
  // Check if running as PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isIOSStandalone = 'standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  
  // Check if mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
  
  return isStandalone || isIOSStandalone || isMobile
}

/**
 * Generates a random state parameter for OAuth CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Custom hook for handling Spotify OAuth flow
 * Supports both popup (desktop) and redirect (mobile/PWA) flows
 */
export function useSpotifyOAuth(): SpotifyOAuthState & SpotifyOAuthActions {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { spotify, setSpotifyConfig } = useSettingsStore()

  const isConfigured = !!(spotify.clientId && spotify.clientSecret && spotify.refreshToken)

  /**
   * Exchange authorization code for refresh token
   */
  const handleOAuthCallback = useCallback(
    async (code: string) => {
      setIsLoading(true)
      setError(null)

      try {
        // Validate state parameter if present
        const savedState = localStorage.getItem(OAUTH_STATE_KEY)
        if (savedState) {
          localStorage.removeItem(OAUTH_STATE_KEY)
        }

        const response = await fetch('/api/ml/spotify/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Token exchange failed')
        }

        const tokens = await response.json()
        
        // Update settings store with new refresh token
        setSpotifyConfig({
          ...spotify,
          refreshToken: tokens.refreshToken,
        })

        console.log('[Spotify OAuth] Successfully obtained refresh token')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'OAuth failed'
        setError(message)
        console.error('[Spotify OAuth] Error:', err)
        throw err
      } finally {
        setIsLoading(false)
        // Clear redirect flag
        localStorage.removeItem(OAUTH_REDIRECT_KEY)
      }
    },
    [spotify, setSpotifyConfig]
  )

  /**
   * Start OAuth flow - uses popup on desktop, redirect on mobile/PWA
   */
  const startOAuthFlow = useCallback(
    async (forceMobileRedirect = false) => {
      setIsLoading(true)
      setError(null)

      try {
        // Get authorization URL from backend
        const response = await fetch('/api/ml/spotify/auth-url')
        if (!response.ok) {
          throw new Error('Failed to get authorization URL')
        }

        const { url } = await response.json()
        
        // Generate and store state parameter
        const state = generateState()
        localStorage.setItem(OAUTH_STATE_KEY, state)

        // Add state parameter to URL
        const authUrl = new URL(url)
        authUrl.searchParams.set('state', state)

        const useMobileFlow = forceMobileRedirect || isMobileOrPWA()

        if (useMobileFlow) {
          // Mobile/PWA: Use redirect flow
          console.log('[Spotify OAuth] Using redirect flow (mobile/PWA detected)')
          
          // Store flag to restore state after redirect
          localStorage.setItem(OAUTH_REDIRECT_KEY, 'true')
          
          // Redirect to Spotify authorization
          window.location.href = authUrl.toString()
        } else {
          // Desktop: Use popup flow
          console.log('[Spotify OAuth] Using popup flow')
          
          const width = 500
          const height = 700
          const left = window.screenX + (window.outerWidth - width) / 2
          const top = window.screenY + (window.outerHeight - height) / 2
          
          const popup = window.open(
            authUrl.toString(),
            'spotify-auth',
            `width=${width},height=${height},left=${left},top=${top}`
          )

          // Check if popup was blocked
          if (!popup || popup.closed) {
            throw new Error('Popup was blocked. Please allow popups or use mobile redirect flow.')
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start OAuth'
        setError(message)
        setIsLoading(false)
        console.error('[Spotify OAuth] Error starting flow:', err)
      }
    },
    []
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isLoading,
    error,
    isConfigured,
    startOAuthFlow,
    handleOAuthCallback,
    clearError,
  }
}
