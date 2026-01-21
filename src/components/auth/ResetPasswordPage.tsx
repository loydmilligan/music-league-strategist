import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Music2, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export function ResetPasswordPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { resetPassword, validateResetToken, isLoading } = useAuthStore()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [tokenStatus, setTokenStatus] = useState<'validating' | 'valid' | 'invalid'>('validating')

  // Prevent double validation in React StrictMode
  const validateAttempted = useRef(false)

  useEffect(() => {
    const validate = async () => {
      if (validateAttempted.current) return
      validateAttempted.current = true

      if (!token) {
        setTokenStatus('invalid')
        return
      }

      const result = await validateResetToken(token)
      setTokenStatus(result.valid ? 'valid' : 'invalid')
    }

    validate()
  }, [token, validateResetToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const result = await resetPassword(token!, password)
    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.message || 'Failed to reset password')
    }
  }

  if (success) {
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
            <h1 className="font-display text-2xl">Password Reset</h1>
          </div>

          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-muted-foreground mb-6">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <Button className="w-full" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (tokenStatus === 'validating') {
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
            <h1 className="font-display text-2xl">Validating Link</h1>
          </div>
          <div className="glass rounded-2xl p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Please wait while we validate your reset link...</p>
          </div>
        </div>
      </div>
    )
  }

  if (tokenStatus === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="font-display text-xl mb-2">Invalid Reset Link</h1>
            <p className="text-muted-foreground mb-6">
              This password reset link is invalid or has expired.
            </p>
            <Link to="/forgot-password">
              <Button variant="outline" className="w-full">
                Request New Reset Link
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className={cn(
            'flex h-16 w-16 items-center justify-center',
            'rounded-2xl bg-primary shadow-glow mb-4'
          )}>
            <Music2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl">Set New Password</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your new password below</p>
        </div>

        {/* Reset Password Form */}
        <div className="glass rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
