import express from 'express'
import cors from 'cors'
import pg from 'pg'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { v4 as uuidv4 } from 'uuid'

const { Pool } = pg

// ============================================================================
// AUTH CONFIGURATION
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m'
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

// Email configuration (Gmail SMTP)
const smtpPort = parseInt(process.env.SMTP_PORT || '587')
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpPort === 465, // true for 465 (SSL), false for 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com'

// Email sending helper
async function sendEmail(to, subject, html) {
  // If SMTP is not configured, log the email instead of sending
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('=== EMAIL (SMTP not configured) ===')
    console.log('To:', to)
    console.log('Subject:', subject)
    console.log('Body:', html)
    console.log('===================================')
    return { messageId: 'test-' + Date.now() }
  }

  return emailTransporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
  })
}

// Generate random token for email verification/password reset
function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

// Helper to generate UUID
function generateUUID() {
  return crypto.randomUUID()
}

// Helper to check if a string is a valid UUID
function isValidUUID(str) {
  if (!str) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

// Helper to transform song from database (snake_case) to frontend (camelCase)
function transformSong(dbSong, currentTier) {
  if (!dbSong) return null
  return {
    id: dbSong.id,
    title: dbSong.title,
    artist: dbSong.artist,
    album: dbSong.album,
    year: dbSong.year,
    genre: dbSong.genre,
    reason: dbSong.reason,
    question: dbSong.question,
    youtubeVideoId: dbSong.youtube_video_id,
    youtubeUrl: dbSong.youtube_url,
    spotifyTrackId: dbSong.spotify_track_id,
    spotifyUri: dbSong.spotify_uri,
    isFavorite: dbSong.is_favorite,
    isEliminated: dbSong.is_eliminated,
    isMuted: dbSong.is_muted,
    userNotes: dbSong.user_notes,
    ratings: dbSong.ratings,
    aiDescription: dbSong.ai_description,
    promotionHistory: dbSong.promotion_history || [],
    currentTier,
  }
}

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mlstrategist',
  user: process.env.DB_USER || 'mlstrategist',
  password: process.env.DB_PASSWORD || 'mlstrategist',
})

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// API routes are served at /api/ml (reverse-proxied in nginx and Vite)
const api = express.Router()
app.use('/api/ml', api)

// Auth router (separate for clarity)
const authRouter = express.Router()
api.use('/auth', authRouter)

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

// Middleware to verify JWT token and attach user to request
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' })
    }
    req.user = user
    next()
  })
}

// Optional auth middleware - attaches user if token present, but doesn't require it
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user
      }
    })
  }
  next()
}

// Health check
api.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

// Register new user
authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' })
  }

  try {
    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Generate verification token
    const verificationToken = generateToken()
    const verificationExpires = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, email_verification_token, email_verification_expires, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, email, email_verified, created_at`,
      [email.toLowerCase(), passwordHash, verificationToken, verificationExpires, Date.now()]
    )

    const user = result.rows[0]

    // Send verification email
    const verifyUrl = `${APP_URL}/verify-email/${verificationToken}`
    await sendEmail(
      user.email,
      'Verify your email - Music League Strategist',
      `
        <h2>Welcome to Music League Strategist!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link will expire in 24 hours.</p>
      `
    )

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// Verify email
authRouter.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params

  try {
    const result = await pool.query(
      `UPDATE users
       SET email_verified = true, email_verification_token = null, email_verification_expires = null, updated_at = $1
       WHERE email_verification_token = $2 AND email_verification_expires > $1
       RETURNING id, email`,
      [Date.now(), token]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' })
    }

    res.json({ message: 'Email verified successfully. You can now log in.' })
  } catch (error) {
    console.error('Email verification error:', error)
    res.status(500).json({ error: 'Verification failed' })
  }
})

// Resend verification email
authRouter.post('/resend-verification', async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    // Find user
    const userResult = await pool.query(
      'SELECT id, email, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a verification link has been sent.' })
    }

    const user = userResult.rows[0]

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' })
    }

    // Generate new verification token
    const verificationToken = generateToken()
    const verificationExpires = Date.now() + (24 * 60 * 60 * 1000)

    await pool.query(
      `UPDATE users SET email_verification_token = $1, email_verification_expires = $2, updated_at = $3 WHERE id = $4`,
      [verificationToken, verificationExpires, Date.now(), user.id]
    )

    // Send verification email
    const verifyUrl = `${APP_URL}/verify-email/${verificationToken}`
    await sendEmail(
      user.email,
      'Verify your email - Music League Strategist',
      `
        <h2>Email Verification</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link will expire in 24 hours.</p>
      `
    )

    res.json({ message: 'If the email exists, a verification link has been sent.' })
  } catch (error) {
    console.error('Resend verification error:', error)
    res.status(500).json({ error: 'Failed to resend verification' })
  }
})

// Login
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const user = result.rows[0]

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED'
      })
    }

    // Generate access token
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRES }
    )

    // Generate refresh token
    const refreshToken = generateToken()
    const refreshExpires = Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days

    // Store refresh token
    await pool.query(
      `INSERT INTO user_sessions (user_id, refresh_token, expires_at, created_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, refreshToken, refreshExpires, Date.now()]
    )

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Logout
authRouter.post('/logout', authenticateToken, async (req, res) => {
  const { refreshToken } = req.body

  try {
    if (refreshToken) {
      // Delete specific session
      await pool.query(
        'DELETE FROM user_sessions WHERE user_id = $1 AND refresh_token = $2',
        [req.user.userId, refreshToken]
      )
    } else {
      // Delete all sessions for user (logout from all devices)
      await pool.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [req.user.userId]
      )
    }

    res.json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Logout failed' })
  }
})

// Refresh access token
authRouter.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' })
  }

  try {
    // Find valid session
    const sessionResult = await pool.query(
      `SELECT us.*, u.email, u.email_verified
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.refresh_token = $1 AND us.expires_at > $2`,
      [refreshToken, Date.now()]
    )

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' })
    }

    const session = sessionResult.rows[0]

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: session.user_id, email: session.email },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRES }
    )

    // Optionally rotate refresh token for added security
    const newRefreshToken = generateToken()
    const newRefreshExpires = Date.now() + (7 * 24 * 60 * 60 * 1000)

    await pool.query(
      `UPDATE user_sessions SET refresh_token = $1, expires_at = $2 WHERE id = $3`,
      [newRefreshToken, newRefreshExpires, session.id]
    )

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: session.user_id,
        email: session.email,
        emailVerified: session.email_verified
      }
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(500).json({ error: 'Token refresh failed' })
  }
})

// Request password reset
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    // Find user
    const result = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If the email exists, a password reset link has been sent.' })
    }

    const user = result.rows[0]

    // Generate reset token
    const resetToken = generateToken()
    const resetExpires = Date.now() + (60 * 60 * 1000) // 1 hour

    await pool.query(
      `UPDATE users SET password_reset_token = $1, password_reset_expires = $2, updated_at = $3 WHERE id = $4`,
      [resetToken, resetExpires, Date.now(), user.id]
    )

    // Send reset email
    const resetUrl = `${APP_URL}/reset-password/${resetToken}`
    await sendEmail(
      user.email,
      'Reset your password - Music League Strategist',
      `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
        <p>Or copy this link: ${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    )

    res.json({ message: 'If the email exists, a password reset link has been sent.' })
  } catch (error) {
    console.error('Password reset request error:', error)
    res.status(500).json({ error: 'Failed to process password reset request' })
  }
})

// Validate reset token (check if it exists and is not expired)
authRouter.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params

  try {
    const result = await pool.query(
      `SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > $2`,
      [token, Date.now()]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired reset token' })
    }

    res.json({ valid: true })
  } catch (error) {
    console.error('Token validation error:', error)
    res.status(500).json({ valid: false, error: 'Failed to validate token' })
  }
})

// Reset password with token
authRouter.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params
  const { password } = req.body

  if (!password) {
    return res.status(400).json({ error: 'Password is required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    // Find user with valid reset token
    const result = await pool.query(
      `SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > $2`,
      [token, Date.now()]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    const user = result.rows[0]

    // Hash new password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Update password and clear reset token
    await pool.query(
      `UPDATE users SET password_hash = $1, password_reset_token = null, password_reset_expires = null, updated_at = $2 WHERE id = $3`,
      [passwordHash, Date.now(), user.id]
    )

    // Invalidate all existing sessions (force re-login)
    await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [user.id])

    res.json({ message: 'Password reset successfully. Please log in with your new password.' })
  } catch (error) {
    console.error('Password reset error:', error)
    res.status(500).json({ error: 'Password reset failed' })
  }
})

// Get current user info
authRouter.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, email_verified, created_at FROM users WHERE id = $1',
      [req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = result.rows[0]
    res.json({
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      createdAt: Number(user.created_at)
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Failed to get user info' })
  }
})

// ============================================================================
// TEST ENDPOINTS (only available in non-production)
// ============================================================================

// Get user token for testing (verification or password reset)
api.get('/test/user-token', async (req, res) => {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' })
  }

  const { email, type } = req.query

  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    let column
    if (type === 'verification') {
      column = 'email_verification_token'
    } else if (type === 'reset') {
      column = 'password_reset_token'
    } else {
      return res.status(400).json({ error: 'Invalid type. Use "verification" or "reset"' })
    }

    const result = await pool.query(
      `SELECT ${column} as token FROM users WHERE email = $1`,
      [email.toLowerCase()]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ token: result.rows[0].token })
  } catch (error) {
    console.error('Test token error:', error)
    res.status(500).json({ error: 'Failed to get token' })
  }
})

// Initialize database schema
async function initDatabase() {
  const client = await pool.connect()
  try {
    // Check if we need to migrate from UUID to TEXT schema
    const schemaCheck = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'themes' AND column_name = 'id'
    `)

    const needsSchemaMigration = schemaCheck.rows.length > 0 && schemaCheck.rows[0].data_type === 'uuid'

    if (needsSchemaMigration) {
      console.log('Migrating database schema from UUID to TEXT IDs...')
      await client.query(`
        DROP TABLE IF EXISTS conversation_history CASCADE;
        DROP TABLE IF EXISTS session_songs CASCADE;
        DROP TABLE IF EXISTS session_preferences CASCADE;
        DROP TABLE IF EXISTS rejected_songs CASCADE;
        DROP TABLE IF EXISTS theme_songs CASCADE;
        DROP TABLE IF EXISTS saved_songs CASCADE;
        DROP TABLE IF EXISTS long_term_preferences CASCADE;
        DROP TABLE IF EXISTS sessions CASCADE;
        DROP TABLE IF EXISTS songs CASCADE;
        DROP TABLE IF EXISTS themes CASCADE;
        DROP TABLE IF EXISTS user_profile CASCADE;
        DROP TABLE IF EXISTS competitor_analysis CASCADE;
        DROP TABLE IF EXISTS settings CASCADE;
        DROP TABLE IF EXISTS ai_models CASCADE;
      `)
      console.log('Old tables dropped, creating new schema...')
    }

    // Check if we need to add user_id columns (migration for auth system)
    const userIdCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'themes' AND column_name = 'user_id'
    `)

    const needsUserIdMigration = schemaCheck.rows.length > 0 && userIdCheck.rows.length === 0

    if (needsUserIdMigration) {
      console.log('Migrating database to add user authentication support...')
      // Drop all existing tables to start fresh with user-scoped data
      // This is simpler than migrating existing data to a default user
      await client.query(`
        DROP TABLE IF EXISTS conversation_history CASCADE;
        DROP TABLE IF EXISTS session_songs CASCADE;
        DROP TABLE IF EXISTS session_preferences CASCADE;
        DROP TABLE IF EXISTS rejected_songs CASCADE;
        DROP TABLE IF EXISTS theme_songs CASCADE;
        DROP TABLE IF EXISTS saved_songs CASCADE;
        DROP TABLE IF EXISTS long_term_preferences CASCADE;
        DROP TABLE IF EXISTS sessions CASCADE;
        DROP TABLE IF EXISTS songs CASCADE;
        DROP TABLE IF EXISTS themes CASCADE;
        DROP TABLE IF EXISTS user_profile CASCADE;
        DROP TABLE IF EXISTS competitor_analysis CASCADE;
        DROP TABLE IF EXISTS settings CASCADE;
        DROP TABLE IF EXISTS ai_models CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS user_sessions CASCADE;
      `)
      console.log('Old tables dropped, creating new schema with user support...')
    }

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      -- Users table (authentication)
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        email_verification_expires BIGINT,
        password_reset_token VARCHAR(255),
        password_reset_expires BIGINT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      -- User sessions (refresh tokens)
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        refresh_token VARCHAR(255) NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      );

      -- Themes table (using TEXT for IDs to support frontend-generated IDs)
      CREATE TABLE IF NOT EXISTS themes (
        id TEXT PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        raw_theme TEXT NOT NULL,
        interpretation TEXT,
        strategy TEXT,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        deadline BIGINT,
        phase VARCHAR(20) DEFAULT 'brainstorm',
        hall_passes_used JSONB DEFAULT '{"semifinals": false, "finals": false}',
        spotify_playlist JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      -- Songs table (central song repository)
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        album VARCHAR(255),
        year INTEGER,
        genre VARCHAR(100),
        reason TEXT,
        question TEXT,
        youtube_video_id VARCHAR(100),
        youtube_url TEXT,
        spotify_track_id VARCHAR(100),
        spotify_uri VARCHAR(100),
        is_favorite BOOLEAN DEFAULT false,
        is_eliminated BOOLEAN DEFAULT false,
        is_muted BOOLEAN DEFAULT false,
        user_notes TEXT,
        ratings JSONB,
        ai_description TEXT,
        promotion_history JSONB DEFAULT '[]',
        created_at BIGINT NOT NULL
      );

      -- Theme-Song relationship (tracks which songs are in which theme/tier)
      CREATE TABLE IF NOT EXISTS theme_songs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        theme_id TEXT REFERENCES themes(id) ON DELETE CASCADE,
        song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
        tier VARCHAR(20) NOT NULL,
        rank INTEGER,
        added_at BIGINT NOT NULL,
        UNIQUE(theme_id, song_id)
      );

      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        phase VARCHAR(50),
        iteration_count INTEGER DEFAULT 0,
        final_pick_id TEXT,
        playlist_created JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      -- Conversation history
      CREATE TABLE IF NOT EXISTS conversation_history (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );

      -- Session working candidates (songs being considered in a session)
      CREATE TABLE IF NOT EXISTS session_songs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
        UNIQUE(session_id, song_id)
      );

      -- Rejected songs
      CREATE TABLE IF NOT EXISTS rejected_songs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        reason TEXT,
        rejected_at BIGINT NOT NULL
      );

      -- Session preferences
      CREATE TABLE IF NOT EXISTS session_preferences (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        statement TEXT NOT NULL,
        confidence VARCHAR(20),
        source VARCHAR(50),
        created_at BIGINT NOT NULL
      );

      -- User profile (user's music taste profile)
      CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        summary TEXT,
        categories JSONB DEFAULT '{}',
        evidence_count INTEGER DEFAULT 0,
        weight REAL DEFAULT 0.5,
        updated_at BIGINT NOT NULL,
        UNIQUE(user_id)
      );

      -- Long-term preferences
      CREATE TABLE IF NOT EXISTS long_term_preferences (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        statement TEXT NOT NULL,
        specificity VARCHAR(20),
        weight REAL DEFAULT 0.5,
        created_at BIGINT NOT NULL
      );

      -- Saved songs (Songs I Like collection)
      CREATE TABLE IF NOT EXISTS saved_songs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
        tags TEXT[],
        notes TEXT,
        source_theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
        saved_at BIGINT NOT NULL
      );

      -- Competitor analysis
      CREATE TABLE IF NOT EXISTS competitor_analysis (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        league_name VARCHAR(255),
        data JSONB NOT NULL,
        imported_at BIGINT NOT NULL,
        UNIQUE(user_id)
      );

      -- Settings (user-specific preferences, not API keys)
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        settings JSONB NOT NULL DEFAULT '{}',
        updated_at BIGINT NOT NULL,
        UNIQUE(user_id)
      );

      -- AI models
      CREATE TABLE IF NOT EXISTS ai_models (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        model_id VARCHAR(255) UNIQUE NOT NULL,
        nickname VARCHAR(100),
        description TEXT,
        tags TEXT[],
        favorite BOOLEAN DEFAULT false,
        model_type VARCHAR(50),
        context_length INTEGER,
        pricing JSONB,
        sort_order INTEGER DEFAULT 0,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_theme_songs_theme ON theme_songs(theme_id);
      CREATE INDEX IF NOT EXISTS idx_theme_songs_tier ON theme_songs(tier);
      CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_timestamp ON conversation_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessions_theme ON sessions(theme_id);
      CREATE INDEX IF NOT EXISTS idx_saved_songs_song ON saved_songs(song_id);
      CREATE INDEX IF NOT EXISTS idx_ai_models_model_id ON ai_models(model_id);

      -- User-related indexes for efficient queries
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(email_verification_token);
      CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(password_reset_token);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token);
      CREATE INDEX IF NOT EXISTS idx_themes_user ON themes(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_saved_songs_user ON saved_songs(user_id);
      CREATE INDEX IF NOT EXISTS idx_long_term_preferences_user ON long_term_preferences(user_id);
    `)

    console.log('Database schema initialized')
  } finally {
    client.release()
  }
}

// ============================================================================
// THEMES API
// ============================================================================

// Get all themes (with song counts)
api.get('/themes', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
        COALESCE(json_agg(
          json_build_object(
            'song', row_to_json(s),
            'tier', ts.tier,
            'rank', ts.rank,
            'added_at', ts.added_at
          )
        ) FILTER (WHERE s.id IS NOT NULL), '[]') as songs
      FROM themes t
      LEFT JOIN theme_songs ts ON t.id = ts.theme_id
      LEFT JOIN songs s ON ts.song_id = s.id
      WHERE t.user_id = $1
      GROUP BY t.id
      ORDER BY t.updated_at DESC
    `, [req.user.userId])

    // Transform to frontend format
    const themes = result.rows.map(row => {
      const songs = row.songs || []
      return {
        id: row.id,
        rawTheme: row.raw_theme,
        interpretation: row.interpretation,
        strategy: row.strategy,
        title: row.title,
        status: row.status,
        deadline: row.deadline ? Number(row.deadline) : null,
        phase: row.phase,
        hallPassesUsed: row.hall_passes_used,
        spotifyPlaylist: row.spotify_playlist,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        candidates: songs.filter(s => s.tier === 'candidates' && s.song).map(s => transformSong(s.song, 'candidates')).filter(Boolean),
        semifinalists: songs.filter(s => s.tier === 'semifinalists' && s.song).map(s => transformSong(s.song, 'semifinalists')).filter(Boolean),
        finalists: songs.filter(s => s.tier === 'finalists' && s.song).map(s => transformSong(s.song, 'finalists')).filter(Boolean),
        pick: transformSong(songs.find(s => s.tier === 'pick')?.song, 'pick'),
      }
    })

    res.json(themes)
  } catch (error) {
    console.error('Error fetching themes:', error)
    res.status(500).json({ error: 'Failed to fetch themes' })
  }
})

// Get single theme with all songs
api.get('/themes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(`
      SELECT t.*,
        COALESCE(json_agg(
          json_build_object(
            'song', row_to_json(s),
            'tier', ts.tier,
            'rank', ts.rank,
            'added_at', ts.added_at
          )
        ) FILTER (WHERE s.id IS NOT NULL), '[]') as songs
      FROM themes t
      LEFT JOIN theme_songs ts ON t.id = ts.theme_id
      LEFT JOIN songs s ON ts.song_id = s.id
      WHERE t.id = $1 AND t.user_id = $2
      GROUP BY t.id
    `, [id, req.user.userId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Theme not found' })
    }

    const row = result.rows[0]
    const songs = row.songs || []

    const theme = {
      id: row.id,
      rawTheme: row.raw_theme,
      interpretation: row.interpretation,
      strategy: row.strategy,
      title: row.title,
      status: row.status,
      deadline: row.deadline ? Number(row.deadline) : null,
      phase: row.phase,
      hallPassesUsed: row.hall_passes_used,
      spotifyPlaylist: row.spotify_playlist,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      candidates: songs.filter(s => s.tier === 'candidates' && s.song).map(s => transformSong(s.song, 'candidates')).filter(Boolean),
      semifinalists: songs.filter(s => s.tier === 'semifinalists' && s.song).map(s => transformSong(s.song, 'semifinalists')).filter(Boolean),
      finalists: songs.filter(s => s.tier === 'finalists' && s.song).map(s => transformSong(s.song, 'finalists')).filter(Boolean),
      pick: transformSong(songs.find(s => s.tier === 'pick')?.song, 'pick'),
    }

    res.json(theme)
  } catch (error) {
    console.error('Error fetching theme:', error)
    res.status(500).json({ error: 'Failed to fetch theme' })
  }
})

// Create theme
api.post('/themes', authenticateToken, async (req, res) => {
  try {
    const { id, rawTheme, title, interpretation, strategy, status, deadline, phase, hallPassesUsed, spotifyPlaylist, createdAt, updatedAt } = req.body
    const now = Date.now()
    const themeId = id || generateUUID()

    const result = await pool.query(`
      INSERT INTO themes (id, user_id, raw_theme, title, interpretation, strategy, status, deadline, phase, hall_passes_used, spotify_playlist, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        raw_theme = EXCLUDED.raw_theme,
        title = EXCLUDED.title,
        interpretation = EXCLUDED.interpretation,
        strategy = EXCLUDED.strategy,
        status = EXCLUDED.status,
        deadline = EXCLUDED.deadline,
        phase = EXCLUDED.phase,
        hall_passes_used = EXCLUDED.hall_passes_used,
        spotify_playlist = EXCLUDED.spotify_playlist,
        updated_at = EXCLUDED.updated_at
      WHERE themes.user_id = $2
      RETURNING *
    `, [themeId, req.user.userId, rawTheme, title, interpretation, strategy, status || 'active', deadline, phase || 'brainstorm', hallPassesUsed || { semifinals: false, finals: false }, spotifyPlaylist, createdAt || now, updatedAt || now])

    const row = result.rows[0]
    res.status(201).json({
      id: row.id,
      rawTheme: row.raw_theme,
      interpretation: row.interpretation,
      strategy: row.strategy,
      title: row.title,
      status: row.status,
      deadline: row.deadline ? Number(row.deadline) : null,
      phase: row.phase,
      hallPassesUsed: row.hall_passes_used,
      spotifyPlaylist: row.spotify_playlist,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      candidates: [],
      semifinalists: [],
      finalists: [],
      pick: null,
    })
  } catch (error) {
    console.error('Error creating theme:', error)
    res.status(500).json({ error: 'Failed to create theme' })
  }
})

// Update theme with funnel data
api.put('/themes/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect()
  try {
    const { id } = req.params
    const { rawTheme, title, interpretation, strategy, status, deadline, phase, hallPassesUsed, spotifyPlaylist, candidates, semifinalists, finalists, pick } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    const result = await client.query(`
      UPDATE themes
      SET raw_theme = COALESCE($1, raw_theme),
          title = COALESCE($2, title),
          interpretation = COALESCE($3, interpretation),
          strategy = COALESCE($4, strategy),
          status = COALESCE($5, status),
          deadline = $6,
          phase = COALESCE($7, phase),
          hall_passes_used = COALESCE($8, hall_passes_used),
          spotify_playlist = COALESCE($9, spotify_playlist),
          updated_at = $10
      WHERE id = $11 AND user_id = $12
      RETURNING *
    `, [rawTheme, title, interpretation, strategy, status, deadline, phase, hallPassesUsed, spotifyPlaylist, now, id, req.user.userId])

    if (result.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Theme not found' })
    }

    // Helper to save songs for a tier
    const saveSongsForTier = async (songs, tier) => {
      if (!songs) return

      // Remove existing songs for this tier
      await client.query('DELETE FROM theme_songs WHERE theme_id = $1 AND tier = $2', [id, tier])

      for (let i = 0; i < songs.length; i++) {
        const song = songs[i]
        if (!song) continue

        // Ensure song exists in songs table
        await client.query(`
          INSERT INTO songs (id, title, artist, album, year, genre, reason, question, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, is_favorite, is_eliminated, is_muted, user_notes, ratings, ai_description, promotion_history, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            artist = EXCLUDED.artist,
            album = EXCLUDED.album,
            year = EXCLUDED.year,
            genre = EXCLUDED.genre,
            reason = EXCLUDED.reason,
            question = EXCLUDED.question,
            youtube_video_id = EXCLUDED.youtube_video_id,
            youtube_url = EXCLUDED.youtube_url,
            spotify_track_id = EXCLUDED.spotify_track_id,
            spotify_uri = EXCLUDED.spotify_uri,
            is_favorite = EXCLUDED.is_favorite,
            is_eliminated = EXCLUDED.is_eliminated,
            is_muted = EXCLUDED.is_muted,
            user_notes = EXCLUDED.user_notes,
            ratings = EXCLUDED.ratings,
            ai_description = EXCLUDED.ai_description,
            promotion_history = EXCLUDED.promotion_history
        `, [
          song.id,
          song.title,
          song.artist,
          song.album,
          song.year,
          song.genre,
          song.reason,
          song.question,
          song.youtubeVideoId,
          song.youtubeUrl,
          song.spotifyTrackId,
          song.spotifyUri,
          song.isFavorite || false,
          song.isEliminated || false,
          song.isMuted || false,
          song.userNotes,
          song.ratings,
          song.aiDescription,
          JSON.stringify(Array.isArray(song.promotionHistory) ? song.promotionHistory : []),
          now
        ])

        // Link song to theme with tier
        await client.query(`
          INSERT INTO theme_songs (theme_id, song_id, tier, rank, added_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (theme_id, song_id) DO UPDATE SET
            tier = EXCLUDED.tier,
            rank = EXCLUDED.rank
        `, [id, song.id, tier, i, now])
      }
    }

    // Save funnel data if provided
    if (candidates !== undefined) {
      await saveSongsForTier(candidates, 'candidates')
    }
    if (semifinalists !== undefined) {
      await saveSongsForTier(semifinalists, 'semifinalists')
    }
    if (finalists !== undefined) {
      await saveSongsForTier(finalists, 'finalists')
    }
    if (pick !== undefined) {
      // Pick is a single song, not an array
      await client.query('DELETE FROM theme_songs WHERE theme_id = $1 AND tier = $2', [id, 'pick'])
      if (pick) {
        await saveSongsForTier([pick], 'pick')
      }
    }

    await client.query('COMMIT')

    const row = result.rows[0]
    res.json({
      id: row.id,
      rawTheme: row.raw_theme,
      interpretation: row.interpretation,
      strategy: row.strategy,
      title: row.title,
      status: row.status,
      deadline: row.deadline ? Number(row.deadline) : null,
      phase: row.phase,
      hallPassesUsed: row.hall_passes_used,
      spotifyPlaylist: row.spotify_playlist,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating theme:', error)
    res.status(500).json({ error: 'Failed to update theme' })
  } finally {
    client.release()
  }
})

// Delete theme
api.delete('/themes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query('DELETE FROM themes WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.userId])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Theme not found' })
    }
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting theme:', error)
    res.status(500).json({ error: 'Failed to delete theme' })
  }
})

// ============================================================================
// SONGS API (within themes)
// ============================================================================

// Add song to theme
api.post('/themes/:themeId/songs', authenticateToken, async (req, res) => {
  const client = await pool.connect()
  try {
    const { themeId } = req.params
    const { song, tier } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    // Verify theme belongs to user
    const themeCheck = await client.query('SELECT id FROM themes WHERE id = $1 AND user_id = $2', [themeId, req.user.userId])
    if (themeCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Theme not found' })
    }

    // Insert or update song (use frontend ID directly, generate UUID only if missing)
    const songId = song.id || generateUUID()
    const songResult = await client.query(`
      INSERT INTO songs (id, title, artist, album, year, genre, reason, question, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, is_favorite, is_eliminated, is_muted, user_notes, ratings, ai_description, promotion_history, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        album = EXCLUDED.album,
        year = EXCLUDED.year,
        genre = EXCLUDED.genre,
        reason = EXCLUDED.reason,
        question = EXCLUDED.question,
        youtube_video_id = EXCLUDED.youtube_video_id,
        youtube_url = EXCLUDED.youtube_url,
        spotify_track_id = EXCLUDED.spotify_track_id,
        spotify_uri = EXCLUDED.spotify_uri,
        is_favorite = EXCLUDED.is_favorite,
        is_eliminated = EXCLUDED.is_eliminated,
        is_muted = EXCLUDED.is_muted,
        user_notes = EXCLUDED.user_notes,
        ratings = EXCLUDED.ratings,
        ai_description = EXCLUDED.ai_description,
        promotion_history = EXCLUDED.promotion_history
      RETURNING *
    `, [
      songId,
      song.title,
      song.artist,
      song.album,
      song.year,
      song.genre,
      song.reason,
      song.question,
      song.youtubeVideoId,
      song.youtubeUrl,
      song.spotifyTrackId,
      song.spotifyUri,
      song.isFavorite || false,
      song.isEliminated || false,
      song.isMuted || false,
      song.userNotes,
      song.ratings,
      song.aiDescription,
      JSON.stringify(Array.isArray(song.promotionHistory) ? song.promotionHistory : []),
      now
    ])

    // songId is already defined above, songResult.rows[0].id should be the same

    // Link song to theme with tier
    await client.query(`
      INSERT INTO theme_songs (theme_id, song_id, tier, rank, added_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (theme_id, song_id) DO UPDATE SET
        tier = EXCLUDED.tier,
        rank = EXCLUDED.rank
    `, [themeId, songId, tier, song.rank || 0, now])

    // Update theme timestamp
    await client.query('UPDATE themes SET updated_at = $1 WHERE id = $2', [now, themeId])

    await client.query('COMMIT')

    const row = songResult.rows[0]
    res.status(201).json({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      year: row.year,
      genre: row.genre,
      reason: row.reason,
      question: row.question,
      youtubeVideoId: row.youtube_video_id,
      youtubeUrl: row.youtube_url,
      spotifyTrackId: row.spotify_track_id,
      spotifyUri: row.spotify_uri,
      isFavorite: row.is_favorite,
      isEliminated: row.is_eliminated,
      isMuted: row.is_muted,
      userNotes: row.user_notes,
      ratings: row.ratings,
      aiDescription: row.ai_description,
      promotionHistory: row.promotion_history || [],
      currentTier: tier,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error adding song to theme:', error)
    res.status(500).json({ error: 'Failed to add song to theme' })
  } finally {
    client.release()
  }
})

// Update song in theme (change tier, mute, etc)
api.put('/themes/:themeId/songs/:songId', async (req, res) => {
  const client = await pool.connect()
  try {
    const { themeId, songId } = req.params
    const { tier, song } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    // Update song properties if provided
    if (song) {
      await client.query(`
        UPDATE songs SET
          title = COALESCE($1, title),
          artist = COALESCE($2, artist),
          album = COALESCE($3, album),
          year = COALESCE($4, year),
          genre = COALESCE($5, genre),
          reason = COALESCE($6, reason),
          question = COALESCE($7, question),
          youtube_video_id = COALESCE($8, youtube_video_id),
          youtube_url = COALESCE($9, youtube_url),
          spotify_track_id = COALESCE($10, spotify_track_id),
          spotify_uri = COALESCE($11, spotify_uri),
          is_favorite = COALESCE($12, is_favorite),
          is_eliminated = COALESCE($13, is_eliminated),
          is_muted = COALESCE($14, is_muted),
          user_notes = COALESCE($15, user_notes),
          ratings = COALESCE($16, ratings),
          ai_description = COALESCE($17, ai_description),
          promotion_history = COALESCE($18, promotion_history)
        WHERE id = $19
      `, [
        song.title, song.artist, song.album, song.year, song.genre,
        song.reason, song.question, song.youtubeVideoId, song.youtubeUrl,
        song.spotifyTrackId, song.spotifyUri, song.isFavorite, song.isEliminated,
        song.isMuted, song.userNotes, song.ratings, song.aiDescription,
        song.promotionHistory, songId
      ])
    }

    // Update tier if provided
    if (tier) {
      await client.query(`
        UPDATE theme_songs SET tier = $1
        WHERE theme_id = $2 AND song_id = $3
      `, [tier, themeId, songId])
    }

    // Update theme timestamp
    await client.query('UPDATE themes SET updated_at = $1 WHERE id = $2', [now, themeId])

    await client.query('COMMIT')

    // Fetch updated song
    const result = await pool.query('SELECT * FROM songs WHERE id = $1', [songId])
    const row = result.rows[0]

    res.json({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      year: row.year,
      genre: row.genre,
      reason: row.reason,
      question: row.question,
      youtubeVideoId: row.youtube_video_id,
      youtubeUrl: row.youtube_url,
      spotifyTrackId: row.spotify_track_id,
      spotifyUri: row.spotify_uri,
      isFavorite: row.is_favorite,
      isEliminated: row.is_eliminated,
      isMuted: row.is_muted,
      userNotes: row.user_notes,
      ratings: row.ratings,
      aiDescription: row.ai_description,
      promotionHistory: row.promotion_history || [],
      currentTier: tier,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating song:', error)
    res.status(500).json({ error: 'Failed to update song' })
  } finally {
    client.release()
  }
})

// Remove song from theme
api.delete('/themes/:themeId/songs/:songId', authenticateToken, async (req, res) => {
  try {
    const { themeId, songId } = req.params
    // Verify theme belongs to user
    const themeCheck = await pool.query('SELECT id FROM themes WHERE id = $1 AND user_id = $2', [themeId, req.user.userId])
    if (themeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Theme not found' })
    }
    await pool.query('DELETE FROM theme_songs WHERE theme_id = $1 AND song_id = $2', [themeId, songId])
    await pool.query('UPDATE themes SET updated_at = $1 WHERE id = $2', [Date.now(), themeId])
    res.status(204).send()
  } catch (error) {
    console.error('Error removing song from theme:', error)
    res.status(500).json({ error: 'Failed to remove song from theme' })
  }
})

// ============================================================================
// SESSIONS API
// ============================================================================

// Get all sessions with full data
api.get('/sessions', authenticateToken, async (req, res) => {
  try {
    // Get sessions with conversation history
    const sessionsResult = await pool.query(`
      SELECT s.*,
        COALESCE(json_agg(
          json_build_object(
            'role', ch.role,
            'content', ch.content,
            'timestamp', ch.timestamp
          ) ORDER BY ch.timestamp
        ) FILTER (WHERE ch.id IS NOT NULL), '[]') as conversation_history
      FROM sessions s
      LEFT JOIN conversation_history ch ON s.id = ch.session_id
      WHERE s.user_id = $1
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `, [req.user.userId])

    // Get all session songs with full song data (only for user's sessions)
    const songsResult = await pool.query(`
      SELECT ss.session_id, songs.*
      FROM session_songs ss
      JOIN songs ON ss.song_id = songs.id
      JOIN sessions s ON ss.session_id = s.id
      WHERE s.user_id = $1
    `, [req.user.userId])

    // Get all rejected songs (only for user's sessions)
    const rejectedResult = await pool.query(`
      SELECT rs.session_id, rs.title, rs.artist, rs.reason, rs.rejected_at
      FROM rejected_songs rs
      JOIN sessions s ON rs.session_id = s.id
      WHERE s.user_id = $1
    `, [req.user.userId])

    // Get all session preferences (only for user's sessions)
    const prefsResult = await pool.query(`
      SELECT sp.session_id, sp.statement, sp.confidence, sp.source, sp.created_at
      FROM session_preferences sp
      JOIN sessions s ON sp.session_id = s.id
      WHERE s.user_id = $1
    `, [req.user.userId])

    // Build lookup maps
    const songsBySession = new Map()
    for (const row of songsResult.rows) {
      const sessionId = row.session_id
      if (!songsBySession.has(sessionId)) {
        songsBySession.set(sessionId, [])
      }
      songsBySession.get(sessionId).push({
        id: row.id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        year: row.year,
        spotifyUri: row.spotify_uri,
        spotifyTrackId: row.spotify_track_id,
        youtubeVideoId: row.youtube_video_id,
        reason: row.reason,
        addedAt: row.added_at,
        favorite: row.favorite,
      })
    }

    const rejectedBySession = new Map()
    for (const row of rejectedResult.rows) {
      const sessionId = row.session_id
      if (!rejectedBySession.has(sessionId)) {
        rejectedBySession.set(sessionId, [])
      }
      rejectedBySession.get(sessionId).push({
        title: row.title,
        artist: row.artist,
        reason: row.reason,
        rejectedAt: row.rejected_at,
      })
    }

    const prefsBySession = new Map()
    for (const row of prefsResult.rows) {
      const sessionId = row.session_id
      if (!prefsBySession.has(sessionId)) {
        prefsBySession.set(sessionId, [])
      }
      prefsBySession.get(sessionId).push({
        statement: row.statement,
        confidence: row.confidence,
        source: row.source,
        createdAt: row.created_at,
      })
    }

    const sessions = sessionsResult.rows.map(row => ({
      id: row.id,
      themeId: row.theme_id,
      title: row.title,
      phase: row.phase,
      iterationCount: row.iteration_count,
      finalPickId: row.final_pick_id,
      playlistCreated: row.playlist_created,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      conversationHistory: row.conversation_history,
      workingCandidates: songsBySession.get(row.id) || [],
      candidates: songsBySession.get(row.id) || [], // For backwards compatibility
      finalists: [], // Legacy field - finalists are now in theme
      rejectedSongs: rejectedBySession.get(row.id) || [],
      sessionPreferences: prefsBySession.get(row.id) || [],
    }))

    res.json(sessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

// Get single session with full data
api.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Get session with conversation history
    const sessionResult = await pool.query(`
      SELECT s.*,
        COALESCE(json_agg(
          json_build_object(
            'role', ch.role,
            'content', ch.content,
            'timestamp', ch.timestamp
          ) ORDER BY ch.timestamp
        ) FILTER (WHERE ch.id IS NOT NULL), '[]') as conversation_history
      FROM sessions s
      LEFT JOIN conversation_history ch ON s.id = ch.session_id
      WHERE s.id = $1
      GROUP BY s.id
    `, [id])

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }

    // Get session songs
    const songsResult = await pool.query(`
      SELECT songs.*
      FROM session_songs ss
      JOIN songs ON ss.song_id = songs.id
      WHERE ss.session_id = $1
    `, [id])

    // Get rejected songs
    const rejectedResult = await pool.query(`
      SELECT title, artist, reason, rejected_at
      FROM rejected_songs
      WHERE session_id = $1
    `, [id])

    // Get session preferences
    const prefsResult = await pool.query(`
      SELECT statement, confidence, source, created_at
      FROM session_preferences
      WHERE session_id = $1
    `, [id])

    const row = sessionResult.rows[0]
    const workingCandidates = songsResult.rows.map(s => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      album: s.album,
      year: s.year,
      spotifyUri: s.spotify_uri,
      spotifyTrackId: s.spotify_track_id,
      youtubeVideoId: s.youtube_video_id,
      reason: s.reason,
      addedAt: s.added_at,
      favorite: s.favorite,
    }))

    res.json({
      id: row.id,
      themeId: row.theme_id,
      title: row.title,
      phase: row.phase,
      iterationCount: row.iteration_count,
      finalPickId: row.final_pick_id,
      playlistCreated: row.playlist_created,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      conversationHistory: row.conversation_history,
      workingCandidates,
      candidates: workingCandidates, // For backwards compatibility
      finalists: [], // Legacy field
      rejectedSongs: rejectedResult.rows.map(r => ({
        title: r.title,
        artist: r.artist,
        reason: r.reason,
        rejectedAt: r.rejected_at,
      })),
      sessionPreferences: prefsResult.rows.map(p => ({
        statement: p.statement,
        confidence: p.confidence,
        source: p.source,
        createdAt: p.created_at,
      })),
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    res.status(500).json({ error: 'Failed to fetch session' })
  }
})

// Create or update session with full data
api.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const {
      id, themeId, title, phase, iterationCount, finalPickId, playlistCreated,
      createdAt, updatedAt, conversationHistory,
      workingCandidates, candidates, rejectedSongs, sessionPreferences
    } = req.body
    const now = Date.now()
    const sessionId = id || generateUUID()

    const result = await pool.query(`
      INSERT INTO sessions (id, user_id, theme_id, title, phase, iteration_count, final_pick_id, playlist_created, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        theme_id = EXCLUDED.theme_id,
        title = EXCLUDED.title,
        phase = EXCLUDED.phase,
        iteration_count = EXCLUDED.iteration_count,
        final_pick_id = EXCLUDED.final_pick_id,
        playlist_created = EXCLUDED.playlist_created,
        updated_at = EXCLUDED.updated_at
      WHERE sessions.user_id = $2
      RETURNING *
    `, [sessionId, req.user.userId, themeId, title, phase || 'exploring', iterationCount || 0, finalPickId, playlistCreated, createdAt || now, updatedAt || now])

    // Insert conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        await pool.query(`
          INSERT INTO conversation_history (session_id, role, content, timestamp)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [sessionId, msg.role, msg.content, msg.timestamp || now])
      }
    }

    // Handle working candidates (use workingCandidates or fall back to candidates)
    const songsToSave = workingCandidates || candidates || []
    if (songsToSave.length > 0) {
      // Clear existing session songs
      await pool.query('DELETE FROM session_songs WHERE session_id = $1', [sessionId])

      for (const song of songsToSave) {
        // First ensure the song exists in the songs table
        await pool.query(`
          INSERT INTO songs (id, title, artist, album, year, spotify_uri, spotify_track_id, youtube_video_id, reason, added_at, favorite)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          song.id, song.title, song.artist, song.album, song.year,
          song.spotifyUri, song.spotifyTrackId, song.youtubeVideoId,
          song.reason, song.addedAt || now, song.favorite || false
        ])

        // Then link it to the session
        await pool.query(`
          INSERT INTO session_songs (session_id, song_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [sessionId, song.id])
      }
    }

    // Handle rejected songs
    if (rejectedSongs && rejectedSongs.length > 0) {
      for (const rs of rejectedSongs) {
        await pool.query(`
          INSERT INTO rejected_songs (session_id, title, artist, reason, rejected_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [sessionId, rs.title, rs.artist, rs.reason, rs.rejectedAt || now])
      }
    }

    // Handle session preferences
    if (sessionPreferences && sessionPreferences.length > 0) {
      for (const pref of sessionPreferences) {
        await pool.query(`
          INSERT INTO session_preferences (session_id, statement, confidence, source, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [sessionId, pref.statement, pref.confidence, pref.source, pref.createdAt || now])
      }
    }

    const row = result.rows[0]
    res.status(201).json({
      id: row.id,
      themeId: row.theme_id,
      title: row.title,
      phase: row.phase,
      iterationCount: row.iteration_count,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      conversationHistory: conversationHistory || [],
      workingCandidates: songsToSave,
      candidates: songsToSave,
      finalists: [],
      rejectedSongs: rejectedSongs || [],
      sessionPreferences: sessionPreferences || [],
    })
  } catch (error) {
    console.error('Error creating session:', error)
    res.status(500).json({ error: 'Failed to create session' })
  }
})

// Update session with full data
api.put('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const {
      title, phase, iterationCount, finalPickId, playlistCreated,
      workingCandidates, candidates, rejectedSongs, sessionPreferences, conversationHistory
    } = req.body
    const now = Date.now()

    const result = await pool.query(`
      UPDATE sessions SET
        title = COALESCE($1, title),
        phase = COALESCE($2, phase),
        iteration_count = COALESCE($3, iteration_count),
        final_pick_id = COALESCE($4, final_pick_id),
        playlist_created = COALESCE($5, playlist_created),
        updated_at = $6
      WHERE id = $7 AND user_id = $8
      RETURNING *
    `, [title, phase, iterationCount, finalPickId, playlistCreated, now, id, req.user.userId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }

    // Handle working candidates (use workingCandidates or fall back to candidates)
    const songsToSave = workingCandidates || candidates
    if (songsToSave && songsToSave.length >= 0) {
      // Clear existing session songs
      await pool.query('DELETE FROM session_songs WHERE session_id = $1', [id])

      for (const song of songsToSave) {
        // First ensure the song exists in the songs table
        await pool.query(`
          INSERT INTO songs (id, title, artist, album, year, spotify_uri, spotify_track_id, youtube_video_id, reason, added_at, favorite)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          song.id, song.title, song.artist, song.album, song.year,
          song.spotifyUri, song.spotifyTrackId, song.youtubeVideoId,
          song.reason, song.addedAt || now, song.favorite || false
        ])

        // Then link it to the session
        await pool.query(`
          INSERT INTO session_songs (session_id, song_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [id, song.id])
      }
    }

    // Handle rejected songs (append, don't replace)
    if (rejectedSongs && rejectedSongs.length > 0) {
      for (const rs of rejectedSongs) {
        await pool.query(`
          INSERT INTO rejected_songs (session_id, title, artist, reason, rejected_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [id, rs.title, rs.artist, rs.reason, rs.rejectedAt || now])
      }
    }

    // Handle session preferences (append, don't replace)
    if (sessionPreferences && sessionPreferences.length > 0) {
      for (const pref of sessionPreferences) {
        await pool.query(`
          INSERT INTO session_preferences (session_id, statement, confidence, source, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [id, pref.statement, pref.confidence, pref.source, pref.createdAt || now])
      }
    }

    // Handle conversation history (append new messages)
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        await pool.query(`
          INSERT INTO conversation_history (session_id, role, content, timestamp)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [id, msg.role, msg.content, msg.timestamp || now])
      }
    }

    const row = result.rows[0]
    res.json({
      id: row.id,
      themeId: row.theme_id,
      title: row.title,
      phase: row.phase,
      iterationCount: row.iteration_count,
      finalPickId: row.final_pick_id,
      playlistCreated: row.playlist_created,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    })
  } catch (error) {
    console.error('Error updating session:', error)
    res.status(500).json({ error: 'Failed to update session' })
  }
})

// Delete session
api.delete('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.userId])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting session:', error)
    res.status(500).json({ error: 'Failed to delete session' })
  }
})

// Add message to session
api.post('/sessions/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { role, content, timestamp } = req.body

    // Verify session belongs to user
    const sessionCheck = await pool.query('SELECT id FROM sessions WHERE id = $1 AND user_id = $2', [id, req.user.userId])
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' })
    }

    await pool.query(`
      INSERT INTO conversation_history (session_id, role, content, timestamp)
      VALUES ($1, $2, $3, $4)
    `, [id, role, content, timestamp || Date.now()])

    await pool.query('UPDATE sessions SET updated_at = $1 WHERE id = $2', [Date.now(), id])

    res.status(201).json({ success: true })
  } catch (error) {
    console.error('Error adding message:', error)
    res.status(500).json({ error: 'Failed to add message' })
  }
})

// ============================================================================
// USER PROFILE API
// ============================================================================

// Get user profile
api.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    const profileResult = await pool.query(
      'SELECT * FROM user_profile WHERE user_id = $1',
      [userId]
    )

    const prefsResult = await pool.query(
      'SELECT * FROM long_term_preferences WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )

    if (profileResult.rows.length === 0) {
      return res.json({
        summary: '',
        categories: { genres: [], eras: [], moods: [], instrumentation: [], vocals: [], lyrics: [], riskAppetite: [], nostalgia: [], dislikes: [], misc: [] },
        evidenceCount: 0,
        weight: 0.5,
        longTermPreferences: [],
        updatedAt: Date.now(),
      })
    }

    const row = profileResult.rows[0]
    res.json({
      summary: row.summary,
      categories: row.categories,
      evidenceCount: row.evidence_count,
      weight: row.weight,
      longTermPreferences: prefsResult.rows.map(p => ({
        statement: p.statement,
        specificity: p.specificity,
        weight: p.weight,
      })),
      updatedAt: row.updated_at,
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// Update user profile
api.put('/profile', authenticateToken, async (req, res) => {
  const client = await pool.connect()
  try {
    const userId = req.user.userId
    const { summary, categories, evidenceCount, weight, longTermPreferences } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    await client.query(`
      INSERT INTO user_profile (user_id, summary, categories, evidence_count, weight, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        categories = EXCLUDED.categories,
        evidence_count = EXCLUDED.evidence_count,
        weight = EXCLUDED.weight,
        updated_at = EXCLUDED.updated_at
    `, [userId, summary, categories, evidenceCount, weight, now])

    // Update long term preferences
    if (longTermPreferences) {
      await client.query('DELETE FROM long_term_preferences WHERE user_id = $1', [userId])
      for (const pref of longTermPreferences) {
        await client.query(`
          INSERT INTO long_term_preferences (user_id, statement, specificity, weight, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [userId, pref.statement, pref.specificity, pref.weight, now])
      }
    }

    await client.query('COMMIT')
    res.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating profile:', error)
    res.status(500).json({ error: 'Failed to update profile' })
  } finally {
    client.release()
  }
})

// ============================================================================
// SAVED SONGS API (Songs I Like)
// ============================================================================

// Get saved songs
api.get('/saved-songs', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ss.*, s.*
      FROM saved_songs ss
      JOIN songs s ON ss.song_id = s.id
      WHERE ss.user_id = $1
      ORDER BY ss.saved_at DESC
    `, [req.user.userId])

    const songs = result.rows.map(row => ({
      id: row.song_id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      year: row.year,
      genre: row.genre,
      reason: row.reason,
      youtubeVideoId: row.youtube_video_id,
      youtubeUrl: row.youtube_url,
      spotifyTrackId: row.spotify_track_id,
      spotifyUri: row.spotify_uri,
      tags: row.tags,
      notes: row.notes,
      sourceThemeId: row.source_theme_id,
      savedAt: row.saved_at,
    }))

    res.json(songs)
  } catch (error) {
    console.error('Error fetching saved songs:', error)
    res.status(500).json({ error: 'Failed to fetch saved songs' })
  }
})

// Save a song
api.post('/saved-songs', authenticateToken, async (req, res) => {
  const client = await pool.connect()
  try {
    const { song, tags, notes, sourceThemeId } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    // Insert or update song (use frontend ID directly)
    const songId = song.id || generateUUID()
    const songResult = await client.query(`
      INSERT INTO songs (id, title, artist, album, year, genre, reason, question, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist
      RETURNING id
    `, [
      songId,
      song.title, song.artist, song.album, song.year, song.genre,
      song.reason, song.question, song.youtubeVideoId, song.youtubeUrl,
      song.spotifyTrackId, song.spotifyUri, now
    ])

    // songId is already defined above

    // Save the song for this user
    await client.query(`
      INSERT INTO saved_songs (user_id, song_id, tags, notes, source_theme_id, saved_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `, [req.user.userId, songId, tags || [], notes, sourceThemeId, now])

    await client.query('COMMIT')

    res.status(201).json({ success: true, songId })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error saving song:', error)
    res.status(500).json({ error: 'Failed to save song' })
  } finally {
    client.release()
  }
})

// Remove saved song
api.delete('/saved-songs/:songId', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.params
    await pool.query('DELETE FROM saved_songs WHERE song_id = $1 AND user_id = $2', [songId, req.user.userId])
    res.status(204).send()
  } catch (error) {
    console.error('Error removing saved song:', error)
    res.status(500).json({ error: 'Failed to remove saved song' })
  }
})

// ============================================================================
// COMPETITOR ANALYSIS API
// ============================================================================

// Get competitor analysis
api.get('/competitor-analysis', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM competitor_analysis WHERE user_id = $1',
      [req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.json(null)
    }

    const row = result.rows[0]
    // Return data in the expected flat structure (rounds, competitors, roundResults at top level)
    res.json({
      leagueName: row.league_name,
      rounds: row.data?.rounds || [],
      competitors: row.data?.competitors || [],
      roundResults: row.data?.roundResults || [],
      importedAt: row.data?.importedAt || Number(row.imported_at),
    })
  } catch (error) {
    console.error('Error fetching competitor analysis:', error)
    res.status(500).json({ error: 'Failed to fetch competitor analysis' })
  }
})

// Import competitor analysis
api.post('/competitor-analysis', authenticateToken, async (req, res) => {
  try {
    const { leagueName, data } = req.body
    const now = Date.now()

    await pool.query(`
      INSERT INTO competitor_analysis (user_id, league_name, data, imported_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        league_name = EXCLUDED.league_name,
        data = EXCLUDED.data,
        imported_at = EXCLUDED.imported_at
    `, [req.user.userId, leagueName, data, now])

    res.status(201).json({ success: true })
  } catch (error) {
    console.error('Error importing competitor analysis:', error)
    res.status(500).json({ error: 'Failed to import competitor analysis' })
  }
})

// ============================================================================
// SETTINGS API
// ============================================================================

// Get settings
api.get('/settings', async (req, res) => {
  try {
    const userId = req.query.userId || 'default'
    const result = await pool.query(
      'SELECT * FROM settings WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.json({
        openRouterKey: '',
        defaultModel: '',
        spotify: { clientId: '', clientSecret: '', refreshToken: '' },
        youtubeMusic: { clientId: '', clientSecret: '', refreshToken: '' },
        ntfy: { enabled: false, topic: '', serverUrl: 'https://ntfy.sh' },
      })
    }

    res.json(result.rows[0].settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// Update settings
api.put('/settings', async (req, res) => {
  try {
    const userId = req.query.userId || 'default'
    const settings = req.body
    const now = Date.now()

    await pool.query(`
      INSERT INTO settings (user_id, settings, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = EXCLUDED.updated_at
    `, [userId, settings, now])

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

// Patch settings (partial update)
api.patch('/settings', async (req, res) => {
  try {
    const userId = req.query.userId || 'default'
    const updates = req.body
    const now = Date.now()

    // Get current settings
    const current = await pool.query(
      'SELECT settings FROM settings WHERE user_id = $1',
      [userId]
    )

    const currentSettings = current.rows.length > 0 ? current.rows[0].settings : {}
    const newSettings = { ...currentSettings, ...updates }

    await pool.query(`
      INSERT INTO settings (user_id, settings, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = EXCLUDED.updated_at
    `, [userId, newSettings, now])

    res.json(newSettings)
  } catch (error) {
    console.error('Error patching settings:', error)
    res.status(500).json({ error: 'Failed to patch settings' })
  }
})

// ============================================================================
// AI MODELS API
// ============================================================================

// Get all models
api.get('/models', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_models ORDER BY favorite DESC, sort_order ASC, created_at DESC'
    )

    const models = result.rows.map(row => ({
      id: row.id,
      modelId: row.model_id,
      nickname: row.nickname,
      description: row.description,
      tags: row.tags,
      favorite: row.favorite,
      modelType: row.model_type,
      contextLength: row.context_length,
      pricing: row.pricing,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    res.json(models)
  } catch (error) {
    console.error('Error fetching models:', error)
    res.status(500).json({ error: 'Failed to fetch models' })
  }
})

// Create model
api.post('/models', async (req, res) => {
  try {
    const { modelId, nickname, description, tags, favorite, modelType, contextLength, pricing, sortOrder } = req.body
    const now = Date.now()

    const result = await pool.query(`
      INSERT INTO ai_models (model_id, nickname, description, tags, favorite, model_type, context_length, pricing, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [modelId, nickname, description, tags || [], favorite || false, modelType, contextLength, pricing, sortOrder || 0, now, now])

    const row = result.rows[0]
    res.status(201).json({
      id: row.id,
      modelId: row.model_id,
      nickname: row.nickname,
      description: row.description,
      tags: row.tags,
      favorite: row.favorite,
      modelType: row.model_type,
      contextLength: row.context_length,
      pricing: row.pricing,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  } catch (error) {
    console.error('Error creating model:', error)
    res.status(500).json({ error: 'Failed to create model' })
  }
})

// Update model
api.put('/models/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { modelId, nickname, description, tags, favorite, modelType, contextLength, pricing, sortOrder } = req.body
    const now = Date.now()

    const result = await pool.query(`
      UPDATE ai_models SET
        model_id = COALESCE($1, model_id),
        nickname = COALESCE($2, nickname),
        description = COALESCE($3, description),
        tags = COALESCE($4, tags),
        favorite = COALESCE($5, favorite),
        model_type = COALESCE($6, model_type),
        context_length = COALESCE($7, context_length),
        pricing = COALESCE($8, pricing),
        sort_order = COALESCE($9, sort_order),
        updated_at = $10
      WHERE id = $11
      RETURNING *
    `, [modelId, nickname, description, tags, favorite, modelType, contextLength, pricing, sortOrder, now, id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating model:', error)
    res.status(500).json({ error: 'Failed to update model' })
  }
})

// Delete model
api.delete('/models/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM ai_models WHERE id = $1', [id])
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting model:', error)
    res.status(500).json({ error: 'Failed to delete model' })
  }
})

// ============================================================================
// MIGRATION API (import from localStorage)
// ============================================================================

api.post('/migrate', async (req, res) => {
  const client = await pool.connect()
  try {
    const { themes, sessions, userProfile, songsILike, settings, competitorAnalysis } = req.body
    const now = Date.now()

    await client.query('BEGIN')

    // Migrate themes and songs
    if (themes && themes.length > 0) {
      for (const theme of themes) {
        // Use existing theme ID (now supports any format, not just UUID)
        const newThemeId = theme.id || generateUUID()

        // Insert theme (ensure JSONB fields are properly formatted)
        const hallPassesUsed = theme.hallPassesUsed ? JSON.stringify(theme.hallPassesUsed) : '{"semifinals": false, "finals": false}'
        const spotifyPlaylist = theme.spotifyPlaylist ? JSON.stringify(theme.spotifyPlaylist) : null

        await client.query(`
          INSERT INTO themes (id, raw_theme, interpretation, strategy, title, status, deadline, phase, hall_passes_used, spotify_playlist, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            raw_theme = EXCLUDED.raw_theme,
            interpretation = EXCLUDED.interpretation,
            strategy = EXCLUDED.strategy,
            title = EXCLUDED.title,
            status = EXCLUDED.status,
            deadline = EXCLUDED.deadline,
            phase = EXCLUDED.phase,
            hall_passes_used = EXCLUDED.hall_passes_used,
            spotify_playlist = EXCLUDED.spotify_playlist,
            updated_at = EXCLUDED.updated_at
        `, [
          newThemeId, theme.rawTheme || '', theme.interpretation || null, theme.strategy || null,
          theme.title || theme.rawTheme?.slice(0, 50) || 'Untitled', theme.status || 'active', theme.deadline || null, theme.phase || 'brainstorm',
          hallPassesUsed, spotifyPlaylist,
          theme.createdAt || now, theme.updatedAt || now
        ])

        // Migrate songs for each tier (generate new UUIDs for non-UUID IDs)
        const songIdMap = new Map() // Map old ID -> new UUID

        const tiers = ['candidates', 'semifinalists', 'finalists']
        for (const tier of tiers) {
          const songs = theme[tier] || []
          for (const song of songs) {
            const newSongId = song.id || generateUUID()
            songIdMap.set(song.id, newSongId)

            // Ensure JSONB fields are properly formatted
            const songRatings = song.ratings ? JSON.stringify(song.ratings) : null
            const songPromotionHistory = song.promotionHistory ? JSON.stringify(song.promotionHistory) : '[]'

            await client.query(`
              INSERT INTO songs (id, title, artist, album, year, genre, reason, question, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, is_favorite, is_eliminated, is_muted, user_notes, ratings, ai_description, promotion_history, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
              ON CONFLICT (id) DO NOTHING
            `, [
              newSongId, song.title || '', song.artist || '', song.album || null, song.year || null, song.genre || null,
              song.reason || null, song.question || null, song.youtubeVideoId || null, song.youtubeUrl || null,
              song.spotifyTrackId || null, song.spotifyUri || null, song.isFavorite || false,
              song.isEliminated || false, song.isMuted || false, song.userNotes || null,
              songRatings, song.aiDescription || null, songPromotionHistory, now
            ])

            await client.query(`
              INSERT INTO theme_songs (theme_id, song_id, tier, rank, added_at)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (theme_id, song_id) DO UPDATE SET tier = EXCLUDED.tier
            `, [newThemeId, newSongId, tier, song.rank || 0, now])
          }
        }

        // Migrate pick
        if (theme.pick) {
          const song = theme.pick
          const newSongId = song.id || generateUUID()
          songIdMap.set(song.id, newSongId)

          // Ensure JSONB fields are properly formatted
          const pickRatings = song.ratings ? JSON.stringify(song.ratings) : null
          const pickPromotionHistory = song.promotionHistory ? JSON.stringify(song.promotionHistory) : '[]'

          await client.query(`
            INSERT INTO songs (id, title, artist, album, year, genre, reason, question, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, is_favorite, is_eliminated, is_muted, user_notes, ratings, ai_description, promotion_history, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            ON CONFLICT (id) DO NOTHING
          `, [
            newSongId, song.title || '', song.artist || '', song.album || null, song.year || null, song.genre || null,
            song.reason || null, song.question || null, song.youtubeVideoId || null, song.youtubeUrl || null,
            song.spotifyTrackId || null, song.spotifyUri || null, song.isFavorite || false,
            song.isEliminated || false, song.isMuted || false, song.userNotes || null,
            pickRatings, song.aiDescription || null, pickPromotionHistory, now
          ])

          await client.query(`
            INSERT INTO theme_songs (theme_id, song_id, tier, rank, added_at)
            VALUES ($1, $2, 'pick', 0, $3)
            ON CONFLICT (theme_id, song_id) DO UPDATE SET tier = 'pick'
          `, [newThemeId, newSongId, now])
        }
      }
    }

    // Migrate user profile
    if (userProfile) {
      // Ensure JSONB field is properly formatted
      const categories = userProfile.categories ? JSON.stringify(userProfile.categories) : '{}'

      await client.query(`
        INSERT INTO user_profile (user_id, summary, categories, evidence_count, weight, updated_at)
        VALUES ('default', $1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          summary = EXCLUDED.summary,
          categories = EXCLUDED.categories,
          evidence_count = EXCLUDED.evidence_count,
          weight = EXCLUDED.weight,
          updated_at = EXCLUDED.updated_at
      `, [userProfile.summary || '', categories, userProfile.evidenceCount || 0, userProfile.weight || 0.5, now])

      if (userProfile.longTermPreferences) {
        for (const pref of userProfile.longTermPreferences) {
          await client.query(`
            INSERT INTO long_term_preferences (user_id, statement, specificity, weight, created_at)
            VALUES ('default', $1, $2, $3, $4)
          `, [pref.statement, pref.specificity, pref.weight, now])
        }
      }
    }

    // Migrate saved songs
    if (songsILike && songsILike.length > 0) {
      for (const song of songsILike) {
        const newSongId = song.id || generateUUID()

        await client.query(`
          INSERT INTO songs (id, title, artist, album, year, genre, reason, youtube_video_id, youtube_url, spotify_track_id, spotify_uri, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          newSongId, song.title, song.artist, song.album, song.year, song.genre,
          song.reason, song.youtubeVideoId, song.youtubeUrl,
          song.spotifyTrackId, song.spotifyUri, now
        ])

        await client.query(`
          INSERT INTO saved_songs (song_id, tags, notes, source_theme_id, saved_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [newSongId, song.tags || [], song.notes, song.sourceThemeId, song.savedAt || now])
      }
    }

    // Migrate settings
    if (settings) {
      // Ensure JSONB field is properly formatted
      const settingsJson = typeof settings === 'string' ? settings : JSON.stringify(settings)

      await client.query(`
        INSERT INTO settings (user_id, settings, updated_at)
        VALUES ('default', $1, $2)
        ON CONFLICT (user_id) DO UPDATE SET
          settings = EXCLUDED.settings,
          updated_at = EXCLUDED.updated_at
      `, [settingsJson, now])
    }

    // Migrate competitor analysis
    if (competitorAnalysis) {
      // Ensure JSONB field is properly formatted - store the entire object as data
      const competitorDataJson = typeof competitorAnalysis === 'string' ? competitorAnalysis : JSON.stringify(competitorAnalysis)

      await client.query(`
        INSERT INTO competitor_analysis (user_id, league_name, data, imported_at)
        VALUES ('default', $1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
          league_name = EXCLUDED.league_name,
          data = EXCLUDED.data,
          imported_at = EXCLUDED.imported_at
      `, [competitorAnalysis.leagueName || null, competitorDataJson, now])
    }

    await client.query('COMMIT')
    res.json({ success: true, message: 'Migration completed successfully' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error during migration:', error)
    res.status(500).json({ error: 'Migration failed', details: error.message })
  } finally {
    client.release()
  }
})

// Check if database has data (for migration detection)
api.get('/has-data', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM themes')
    res.json({ hasData: parseInt(result.rows[0].count) > 0 })
  } catch (error) {
    console.error('Error checking data:', error)
    res.status(500).json({ error: 'Failed to check data' })
  }
})

// ============================================================================
// SPOTIFY OAUTH
// ============================================================================

const SPOTIFY_CLIENT_ID = process.env.VITE_SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.VITE_SPOTIFY_CLIENT_SECRET
const SPOTIFY_CALLBACK_URL = process.env.VITE_SPOTIFY_CALLBACK_URL || 'http://localhost:3000/api/ml/spotify/callback'

const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-read-private',
  // Web Playback SDK scopes for full playback control
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ')

// Get Spotify authorization URL
api.get('/spotify/auth-url', (req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    return res.status(500).json({ error: 'Spotify client ID not configured on server' })
  }

  const authUrl = new URL('https://accounts.spotify.com/authorize')
  authUrl.searchParams.set('client_id', SPOTIFY_CLIENT_ID)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', SPOTIFY_CALLBACK_URL)
  authUrl.searchParams.set('scope', SPOTIFY_SCOPES)
  authUrl.searchParams.set('show_dialog', 'true')

  res.json({
    url: authUrl.toString(),
    callbackUrl: SPOTIFY_CALLBACK_URL,
  })
})

// Exchange authorization code for tokens
api.post('/spotify/exchange', async (req, res) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' })
    }

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Spotify credentials not configured on server' })
    }

    const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_CALLBACK_URL,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Spotify token exchange failed:', errorText)
      return res.status(response.status).json({ error: 'Token exchange failed', details: errorText })
    }

    const tokens = await response.json()

    // Return only what the frontend needs
    res.json({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
    })
  } catch (error) {
    console.error('Error exchanging Spotify code:', error)
    res.status(500).json({ error: 'Failed to exchange code for tokens' })
  }
})

// Callback endpoint for OAuth redirect
api.get('/spotify/callback', (req, res) => {
  const { code, error, state } = req.query

  // Detect if this is a popup or redirect flow
  // Popup flow: window.opener exists (desktop browsers)
  // Redirect flow: window.opener is null (mobile/PWA)
  
  // Return an HTML page that handles both flows
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Spotify Authorization</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: system-ui, sans-serif; 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh; 
          margin: 0; 
          background: #0f0f0f; 
          color: #fff; 
        }
        .container { 
          text-align: center; 
          padding: 2rem; 
          max-width: 400px;
        }
        .success { color: #1DB954; }
        .error { color: #ff4444; }
        .spinner {
          border: 3px solid #333;
          border-top: 3px solid #1DB954;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 1rem auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${error
          ? `<h2 class="error">Authorization Failed</h2><p>${error}</p>`
          : `<h2 class="success">Authorization Successful!</h2><div class="spinner"></div><p>Redirecting...</p>`
        }
      </div>
      <script>
        (function() {
          const code = '${code || ''}';
          const error = '${error || ''}';
          const state = '${state || ''}';
          
          // Try popup flow first (desktop)
          if (window.opener && !window.opener.closed) {
            console.log('[Spotify OAuth] Using popup flow');
            if (error) {
              window.opener.postMessage({ type: 'spotify-auth-error', error }, '*');
            } else {
              window.opener.postMessage({ type: 'spotify-auth-success', code }, '*');
            }
            setTimeout(() => window.close(), 2000);
          } else {
            // Redirect flow (mobile/PWA)
            console.log('[Spotify OAuth] Using redirect flow');
            if (error) {
              // Redirect back to app with error
              window.location.href = '/?error=' + encodeURIComponent(error);
            } else {
              // Redirect back to app with code
              window.location.href = '/?code=' + encodeURIComponent(code) + (state ? '&state=' + encodeURIComponent(state) : '');
            }
          }
        })();
      </script>
    </body>
    </html>
  `

  res.type('html').send(html)
})

// Check if Spotify OAuth is configured on server
api.get('/spotify/status', (req, res) => {
  res.json({
    configured: Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET),
    hasClientId: Boolean(SPOTIFY_CLIENT_ID),
    hasClientSecret: Boolean(SPOTIFY_CLIENT_SECRET),
    callbackUrl: SPOTIFY_CALLBACK_URL,
  })
})

// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  try {
    await initDatabase()
    app.listen(PORT, () => {
      console.log(`Music League API running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()
