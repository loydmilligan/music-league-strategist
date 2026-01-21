import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:3001/api/ml'

// Helper to generate unique email for each test
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@test.local`
}

// Helper to wait for a condition with retries
async function waitForToken(
  fetchFn: () => Promise<string | null>,
  maxRetries = 10,
  delayMs = 500
): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    const token = await fetchFn()
    if (token) return token
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  return null
}

// Helper to query database for verification token (with retry)
async function getVerificationToken(email: string): Promise<string | null> {
  return waitForToken(async () => {
    const response = await fetch(`${API_BASE}/test/user-token?email=${encodeURIComponent(email)}&type=verification`)
    if (!response.ok) return null
    const data = await response.json()
    return data.token || null
  })
}

// Helper to query database for password reset token (with retry)
async function getPasswordResetToken(email: string): Promise<string | null> {
  return waitForToken(async () => {
    const response = await fetch(`${API_BASE}/test/user-token?email=${encodeURIComponent(email)}&type=reset`)
    if (!response.ok) return null
    const data = await response.json()
    return data.token || null
  })
}

test.describe('Authentication System', () => {
  test.describe('Registration', () => {
    test('should show registration page', async ({ page }) => {
      await page.goto('/register')

      await expect(page.getByText('Music League Strategist')).toBeVisible()
      await expect(page.getByText('Create your account')).toBeVisible()
      await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
      await expect(page.locator('input#password')).toBeVisible()
    })

    test('should require matching passwords', async ({ page }) => {
      await page.goto('/register')

      await page.fill('input#email', uniqueEmail('test'))
      await page.fill('input#password', 'password123')
      await page.fill('input#confirmPassword', 'different123')

      await page.click('button[type="submit"]')

      await expect(page.getByText('Passwords do not match')).toBeVisible()
    })

    test('should require minimum 6 character password', async ({ page }) => {
      await page.goto('/register')

      await page.fill('input#email', uniqueEmail('test'))
      await page.fill('input#password', '12345')
      await page.fill('input#confirmPassword', '12345')

      await page.click('button[type="submit"]')

      // Either browser native validation or our JS validation should prevent submission
      // We're still on the register page (not on success page)
      await expect(page.getByText('Create your account')).toBeVisible()
      // And no success message appears
      await expect(page.getByText(/verification link/i)).not.toBeVisible()
    })

    test('should successfully register new user', async ({ page }) => {
      const email = uniqueEmail('register')

      await page.goto('/register')

      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.fill('input#confirmPassword', 'testpassword123')

      await page.click('button[type="submit"]')

      // Should show success message about verification email
      await expect(page.getByText(/verification link/i)).toBeVisible({ timeout: 10000 })
    })

    test('should prevent duplicate email registration', async ({ page }) => {
      const email = uniqueEmail('duplicate')

      // Register first time
      await page.goto('/register')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.fill('input#confirmPassword', 'testpassword123')
      await page.click('button[type="submit"]')

      await expect(page.getByText(/verification link/i)).toBeVisible({ timeout: 10000 })

      // Try to register again with same email
      await page.goto('/register')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.fill('input#confirmPassword', 'testpassword123')
      await page.click('button[type="submit"]')

      // Should show error about existing email
      await expect(page.getByText(/already exists|already registered/i)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Login', () => {
    test('should show login page', async ({ page }) => {
      await page.goto('/login')

      await expect(page.getByText('Music League Strategist')).toBeVisible()
      await expect(page.getByText('Sign in to your account')).toBeVisible()
      await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
      await expect(page.locator('input#password')).toBeVisible()
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login')

      await page.fill('input#email', 'nonexistent@test.local')
      await page.fill('input#password', 'wrongpassword')

      await page.click('button[type="submit"]')

      await expect(page.getByText(/invalid|incorrect|not found/i)).toBeVisible({ timeout: 10000 })
    })

    test('should show error for unverified email', async ({ page }) => {
      const email = uniqueEmail('unverified')

      // Register but don't verify
      await page.goto('/register')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.fill('input#confirmPassword', 'testpassword123')
      await page.click('button[type="submit"]')
      await expect(page.getByText(/verification link/i)).toBeVisible({ timeout: 10000 })

      // Try to login
      await page.goto('/login')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.click('button[type="submit"]')

      // Should show unverified error
      await expect(page.getByText(/not verified/i)).toBeVisible({ timeout: 10000 })
    })

    test('should link to registration page', async ({ page }) => {
      await page.goto('/login')

      await page.click('text=Create one')

      await expect(page).toHaveURL('/register')
    })

    test('should link to forgot password page', async ({ page }) => {
      await page.goto('/login')

      await page.click('text=Forgot password?')

      await expect(page).toHaveURL('/forgot-password')
    })
  })

  test.describe('Email Verification', () => {
    test('should verify email with valid token', async ({ page }) => {
      const email = uniqueEmail('verify')
      console.log('Test email:', email)

      // Register user
      await page.goto('/register')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.fill('input#confirmPassword', 'testpassword123')
      await page.click('button[type="submit"]')
      await expect(page.getByText(/verification link/i)).toBeVisible({ timeout: 10000 })
      console.log('Registration completed')

      // Wait a bit for database write to complete
      await page.waitForTimeout(1000)

      // Get verification token from database
      const token = await getVerificationToken(email)
      console.log('Token received:', token)
      expect(token).toBeTruthy()

      // Verify email
      const verifyUrl = `/verify-email/${token}`
      console.log('Navigating to:', verifyUrl)
      await page.goto(verifyUrl)

      // Wait for API call to complete
      await page.waitForTimeout(2000)

      // Should show success message (heading)
      await expect(page.getByRole('heading', { name: 'Email Verified!' })).toBeVisible({ timeout: 10000 })
    })

    test('should show error for invalid verification token', async ({ page }) => {
      await page.goto('/verify-email/invalid-token-12345')

      await expect(page.getByText('Invalid or expired')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Password Reset', () => {
    test('should show forgot password page', async ({ page }) => {
      await page.goto('/forgot-password')

      await expect(page.getByText('Reset Password')).toBeVisible()
      await expect(page.getByText('Enter your email to receive a reset link')).toBeVisible()
      await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    })

    test('should request password reset', async ({ page }) => {
      const email = uniqueEmail('reset')

      // Register and verify user first
      await page.goto('/register')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.fill('input#confirmPassword', 'testpassword123')
      await page.click('button[type="submit"]')
      await expect(page.getByText(/verification link/i)).toBeVisible({ timeout: 10000 })

      // Get verification token and verify
      const verifyToken = await getVerificationToken(email)
      await page.goto(`/verify-email/${verifyToken}`)
      await expect(page.getByRole('heading', { name: 'Email Verified!' })).toBeVisible({ timeout: 10000 })

      // Request password reset
      await page.goto('/forgot-password')
      await page.fill('input#email', email)
      await page.click('button[type="submit"]')

      // Should show success message
      await expect(page.getByText(/password reset link/i)).toBeVisible({ timeout: 10000 })
    })

    test('should reset password with valid token', async ({ page }) => {
      const email = uniqueEmail('pwreset')

      // Register and verify user
      await page.goto('/register')
      await page.fill('input#email', email)
      await page.fill('input#password', 'oldpassword123')
      await page.fill('input#confirmPassword', 'oldpassword123')
      await page.click('button[type="submit"]')
      await expect(page.getByText(/verification link/i)).toBeVisible({ timeout: 10000 })

      const verifyToken = await getVerificationToken(email)
      await page.goto(`/verify-email/${verifyToken}`)
      await expect(page.getByRole('heading', { name: 'Email Verified!' })).toBeVisible({ timeout: 10000 })

      // Request password reset
      await page.goto('/forgot-password')
      await page.fill('input#email', email)
      await page.click('button[type="submit"]')
      await expect(page.getByText(/password reset link/i)).toBeVisible({ timeout: 10000 })

      // Get reset token
      const resetToken = await getPasswordResetToken(email)
      expect(resetToken).toBeTruthy()

      // Reset password
      await page.goto(`/reset-password/${resetToken}`)
      await page.fill('input#password', 'newpassword456')
      await page.fill('input#confirmPassword', 'newpassword456')
      await page.click('button[type="submit"]')

      // Should show success
      await expect(page.getByText(/reset successfully/i)).toBeVisible({ timeout: 10000 })
    })

    test('should show error for invalid reset token', async ({ page }) => {
      await page.goto('/reset-password/invalid-token-12345')

      // Invalid token shows "Invalid Reset Link" page
      await expect(page.getByText('Invalid Reset Link')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Clear any existing auth state
      await page.goto('/login')
      await page.evaluate(() => {
        localStorage.clear()
      })

      // Try to access protected route
      await page.goto('/')

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/)
    })

    test('should allow authenticated users to access app', async ({ page }) => {
      const email = uniqueEmail('access')

      // Register and verify
      await page.goto('/register')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.fill('input#confirmPassword', 'testpassword123')
      await page.click('button[type="submit"]')
      await expect(page.getByText(/verification link/i)).toBeVisible({ timeout: 10000 })

      const verifyToken = await getVerificationToken(email)
      await page.goto(`/verify-email/${verifyToken}`)
      await expect(page.getByRole('heading', { name: 'Email Verified!' })).toBeVisible({ timeout: 10000 })

      // Login
      await page.goto('/login')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.click('button[type="submit"]')

      // Should be redirected to main app (not login page)
      await page.waitForTimeout(2000)
      await expect(page).not.toHaveURL(/\/login/)
    })
  })

  test.describe('Logout', () => {
    test('should logout user and redirect to login', async ({ page }) => {
      const email = uniqueEmail('logout')

      // Register and verify
      await page.goto('/register')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.fill('input#confirmPassword', 'testpassword123')
      await page.click('button[type="submit"]')
      await expect(page.getByText(/verification link/i)).toBeVisible({ timeout: 10000 })

      const verifyToken = await getVerificationToken(email)
      await page.goto(`/verify-email/${verifyToken}`)

      // Login
      await page.goto('/login')
      await page.fill('input#email', email)
      await page.fill('input#password', 'testpassword123')
      await page.click('button[type="submit"]')

      // Wait for app to load
      await page.waitForTimeout(3000)

      // Navigate to profile and logout
      await page.click('[data-testid="nav-profile"]')
      await page.waitForTimeout(500)
      await page.click('text=Sign Out')

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    })
  })
})
