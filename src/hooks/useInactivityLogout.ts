/**
 * Inactivity Logout Hook
 * Automatically logs out users after a period of inactivity
 */

import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'

// Default timeout: 30 minutes of inactivity
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

// Events that count as "activity"
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'visibilitychange'
]

interface UseInactivityLogoutOptions {
  timeoutMs?: number
  onLogout?: () => void
}

export function useInactivityLogout(options: UseInactivityLogoutOptions = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onLogout } = options
  const { isAuthenticated, logout } = useAuthStore()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const handleLogout = useCallback(async () => {
    console.log('[InactivityLogout] Logging out due to inactivity')
    await logout()
    onLogout?.()
  }, [logout, onLogout])

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Only set timeout if authenticated
    if (isAuthenticated) {
      timeoutRef.current = setTimeout(() => {
        handleLogout()
      }, timeoutMs)
    }
  }, [isAuthenticated, timeoutMs, handleLogout])

  const handleActivity = useCallback(() => {
    // Don't reset on every tiny mouse move - throttle to once per second
    const now = Date.now()
    if (now - lastActivityRef.current > 1000) {
      resetTimer()
    }
  }, [resetTimer])

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      // User returned to the tab - check if they've been away too long
      const timeSinceLastActivity = Date.now() - lastActivityRef.current
      if (timeSinceLastActivity >= timeoutMs && isAuthenticated) {
        handleLogout()
      } else {
        resetTimer()
      }
    }
  }, [timeoutMs, isAuthenticated, handleLogout, resetTimer])

  useEffect(() => {
    if (!isAuthenticated) {
      // Clear timeout if not authenticated
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    // Start the timer
    resetTimer()

    // Add activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      if (event === 'visibilitychange') {
        document.addEventListener(event, handleVisibilityChange)
      } else {
        window.addEventListener(event, handleActivity, { passive: true })
      }
    })

    return () => {
      // Cleanup
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      ACTIVITY_EVENTS.forEach(event => {
        if (event === 'visibilitychange') {
          document.removeEventListener(event, handleVisibilityChange)
        } else {
          window.removeEventListener(event, handleActivity)
        }
      })
    }
  }, [isAuthenticated, resetTimer, handleActivity, handleVisibilityChange])

  return {
    resetTimer,
    lastActivity: lastActivityRef.current
  }
}
