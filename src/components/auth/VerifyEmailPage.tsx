import { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Music2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function VerifyEmailPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { verifyEmail } = useAuthStore()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  // Prevent double verification in React StrictMode
  const verifyAttempted = useRef(false)

  useEffect(() => {
    const verify = async () => {
      // Prevent duplicate calls (React StrictMode calls effects twice)
      if (verifyAttempted.current) {
        return
      }
      verifyAttempted.current = true

      if (!token) {
        setStatus('error')
        setMessage('Invalid verification link')
        return
      }

      const result = await verifyEmail(token)
      if (result.success) {
        setStatus('success')
        setMessage(result.message || 'Email verified successfully!')
      } else {
        setStatus('error')
        setMessage(result.message || 'Verification failed')
      }
    }

    verify()
  }, [token, verifyEmail])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className={cn(
              'flex h-16 w-16 items-center justify-center',
              'rounded-2xl bg-primary shadow-glow mb-4 animate-pulse'
            )}>
              <Music2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-2xl">Verifying Email</h1>
          </div>

          <div className="glass rounded-2xl p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Please wait while we verify your email...</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className={cn(
              'flex h-16 w-16 items-center justify-center',
              'rounded-2xl bg-green-500 shadow-glow mb-4'
            )}>
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="font-display text-2xl">Email Verified!</h1>
          </div>

          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button className="w-full" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className={cn(
            'flex h-16 w-16 items-center justify-center',
            'rounded-2xl bg-destructive shadow-glow mb-4'
          )}>
            <AlertCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-display text-2xl">Verification Failed</h1>
        </div>

        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-muted-foreground mb-6">{message}</p>
          <p className="text-sm text-muted-foreground mb-4">
            The verification link may have expired or already been used.
          </p>
          <div className="space-y-2">
            <Link to="/login">
              <Button variant="outline" className="w-full">
                Go to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
