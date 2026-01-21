import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Music2, Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export function ForgotPasswordPage(): React.ReactElement {
  const { forgotPassword, isLoading } = useAuthStore()

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const result = await forgotPassword(email)
    if (result.success) {
      setSubmitted(true)
    } else {
      setError(result.message || 'Failed to send reset email')
    }
  }

  if (submitted) {
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
            <h1 className="font-display text-2xl">Check Your Email</h1>
          </div>

          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-muted-foreground mb-4">
              If an account exists with that email, we've sent a password reset link.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Check your inbox at <strong>{email}</strong> and follow the instructions to reset your password.
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
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
          <h1 className="font-display text-2xl">Reset Password</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your email to receive a reset link</p>
        </div>

        {/* Forgot Password Form */}
        <div className="glass rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="inline h-4 w-4 mr-1" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
