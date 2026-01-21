import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2, Music2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps): React.ReactElement {
  const location = useLocation()
  const { isAuthenticated, accessToken, refreshAccessToken, fetchCurrentUser } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      if (accessToken && !isAuthenticated) {
        // We have a token but no user, try to refresh
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          await fetchCurrentUser()
        }
      } else if (accessToken && isAuthenticated) {
        // Verify the user is still valid
        await fetchCurrentUser()
      }
      setIsChecking(false)
    }

    checkAuth()
  }, [accessToken, isAuthenticated, refreshAccessToken, fetchCurrentUser])

  // Show loading state while checking authentication
  if (isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className={cn(
          'flex h-16 w-16 items-center justify-center',
          'rounded-2xl bg-primary shadow-glow mb-4'
        )}>
          <Music2 className="h-8 w-8 text-primary-foreground" />
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // User is authenticated, render children
  return <>{children}</>
}
