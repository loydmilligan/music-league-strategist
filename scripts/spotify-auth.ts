/**
 * Spotify OAuth Token Generator
 *
 * Uses Playwright to automate the OAuth flow and generate a refresh token.
 *
 * Usage:
 *   npm run spotify-auth
 *   # or
 *   npx tsx scripts/spotify-auth.ts
 *
 * Prerequisites:
 *   - VITE_SPOTIFY_CLIENT_ID in .env
 *   - VITE_SPOTIFY_CLIENT_SECRET in .env
 *   - VITE_SPOTIFY_CALLBACK_URL in .env (any https URL works, doesn't need to be live)
 *
 * Note: This script opens a browser window for you to log in to Spotify.
 * It must be run on a machine with a display (not headless server).
 *
 * Alternative (manual) - if Playwright doesn't work:
 *   1. Run with --manual flag: npm run spotify-auth -- --manual
 *   2. Open the printed URL in your browser
 *   3. Log in and copy the 'code' parameter from the redirect URL
 *   4. Paste it when prompted
 */

import { chromium } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const MANUAL_MODE = process.argv.includes('--manual')

const CLIENT_ID = process.env.VITE_SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.VITE_SPOTIFY_CLIENT_SECRET
const REDIRECT_URI = process.env.VITE_SPOTIFY_CALLBACK_URL

// Scopes needed for playlist management
const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-read-private',
].join(' ')

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function buildAuthUrl(): string {
  const authUrl = new URL('https://accounts.spotify.com/authorize')
  authUrl.searchParams.set('client_id', CLIENT_ID!)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI!)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('show_dialog', 'true')
  return authUrl.toString()
}

async function getAuthorizationCodeManual(): Promise<string> {
  const authUrl = buildAuthUrl()

  console.log('\n=== Spotify OAuth Flow (Manual Mode) ===\n')
  console.log('1. Open this URL in your browser:\n')
  console.log(authUrl)
  console.log('\n2. Log in to Spotify and authorize the app.')
  console.log('3. After authorizing, you\'ll be redirected to a URL like:')
  console.log(`   ${REDIRECT_URI}?code=XXXXXXXXXX...\n`)
  console.log('4. Copy the entire "code" value from the URL.\n')

  const input = await prompt('Paste the authorization code (or full redirect URL): ')

  // Handle both raw code and full URL
  let code = input
  if (input.includes('code=')) {
    const url = new URL(input)
    code = url.searchParams.get('code') || ''
  }

  if (!code) {
    throw new Error('No authorization code provided')
  }

  console.log('\nAuthorization code received!\n')
  return code
}

async function getAuthorizationCodeBrowser(): Promise<string> {
  const authUrl = buildAuthUrl()

  console.log('\n=== Spotify OAuth Flow ===\n')
  console.log('Opening browser for Spotify login...')
  console.log('Please log in and authorize the app.\n')

  const browser = await chromium.launch({
    headless: false,  // Need visible browser for user login
    slowMo: 100
  })

  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(authUrl)

  // Wait for redirect to callback URL (even if it fails to load, we get the code)
  console.log('Waiting for authorization...')
  console.log(`(Will redirect to: ${REDIRECT_URI})\n`)

  try {
    // Wait for URL to change to our callback URL
    await page.waitForURL(url => url.toString().startsWith(REDIRECT_URI!), {
      timeout: 120000,  // 2 minute timeout for user to log in
    })
  } catch {
    // Even if page fails to load, check if we got redirected with a code
    const currentUrl = page.url()
    if (!currentUrl.startsWith(REDIRECT_URI!)) {
      await browser.close()
      throw new Error('Authorization timed out or was cancelled')
    }
  }

  // Extract code from URL
  const finalUrl = new URL(page.url())
  const code = finalUrl.searchParams.get('code')
  const error = finalUrl.searchParams.get('error')

  await browser.close()

  if (error) {
    throw new Error(`Spotify authorization error: ${error}`)
  }

  if (!code) {
    throw new Error('No authorization code received')
  }

  console.log('Authorization code received!\n')
  return code
}

async function getAuthorizationCode(): Promise<string> {
  if (MANUAL_MODE) {
    return getAuthorizationCodeManual()
  }
  return getAuthorizationCodeBrowser()
}

async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  console.log('Exchanging code for tokens...\n')

  const tokenUrl = 'https://accounts.spotify.com/api/token'
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI!,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`)
  }

  return response.json()
}

async function main() {
  // Validate environment variables
  if (!CLIENT_ID) {
    console.error('Error: VITE_SPOTIFY_CLIENT_ID not set in .env')
    process.exit(1)
  }
  if (!CLIENT_SECRET) {
    console.error('Error: VITE_SPOTIFY_CLIENT_SECRET not set in .env')
    process.exit(1)
  }
  if (!REDIRECT_URI) {
    console.error('Error: VITE_SPOTIFY_CALLBACK_URL not set in .env')
    process.exit(1)
  }

  console.log('Configuration:')
  console.log(`  Client ID: ${CLIENT_ID.substring(0, 8)}...`)
  console.log(`  Redirect URI: ${REDIRECT_URI}`)
  console.log(`  Scopes: ${SCOPES}\n`)

  try {
    // Step 1: Get authorization code via browser
    const code = await getAuthorizationCode()

    // Step 2: Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Display results
    console.log('=== SUCCESS ===\n')
    console.log('Add this to your .env file:\n')
    console.log(`VITE_SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}\n`)
    console.log('---')
    console.log(`Access Token (expires in ${tokens.expires_in}s):`)
    console.log(`${tokens.access_token.substring(0, 50)}...\n`)

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
