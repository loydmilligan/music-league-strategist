/**
 * Spotify Web Playback SDK Hook
 * Provides full playback control for Spotify Premium users
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

// Spotify Web Playback SDK types
interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, callback: (data: unknown) => void) => void
  removeListener: (event: string, callback?: (data: unknown) => void) => void
  getCurrentState: () => Promise<SpotifyPlaybackState | null>
  setName: (name: string) => void
  getVolume: () => Promise<number>
  setVolume: (volume: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlay: () => Promise<void>
  seek: (position_ms: number) => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
}

interface SpotifyPlaybackState {
  context: {
    uri: string | null
    metadata: Record<string, unknown>
  }
  disallows: {
    pausing?: boolean
    peeking_next?: boolean
    peeking_prev?: boolean
    resuming?: boolean
    seeking?: boolean
    skipping_next?: boolean
    skipping_prev?: boolean
  }
  duration: number
  paused: boolean
  position: number
  repeat_mode: number
  shuffle: boolean
  track_window: {
    current_track: SpotifyTrack
    previous_tracks: SpotifyTrack[]
    next_tracks: SpotifyTrack[]
  }
}

interface SpotifyTrack {
  uri: string
  id: string | null
  type: string
  media_type: string
  name: string
  is_playable: boolean
  album: {
    uri: string
    name: string
    images: Array<{ url: string; height: number; width: number }>
  }
  artists: Array<{ uri: string; name: string }>
  duration_ms: number
}

interface SpotifyReadyEvent {
  device_id: string
}

interface SpotifyErrorEvent {
  message: string
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

export interface UseSpotifyPlayerState {
  isReady: boolean
  isPlaying: boolean
  isPaused: boolean
  deviceId: string | null
  currentTrack: SpotifyTrack | null
  position: number
  duration: number
  volume: number
  error: string | null
  isTransferring: boolean
  isPremium: boolean | null
}

export interface UseSpotifyPlayerActions {
  play: (spotifyUri?: string) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlay: () => Promise<void>
  seek: (positionMs: number) => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
  setVolume: (volume: number) => Promise<void>
  transferPlayback: () => Promise<boolean>
  disconnect: () => void
}

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js'

export function useSpotifyPlayer(): UseSpotifyPlayerState & UseSpotifyPlayerActions {
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.5)
  const [error, setError] = useState<string | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [isPremium, setIsPremium] = useState<boolean | null>(null)

  const playerRef = useRef<SpotifyPlayer | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const tokenExpiryRef = useRef<number>(0)

  const { spotify } = useSettingsStore()
  const isConfigured = !!(spotify.clientId && spotify.clientSecret && spotify.refreshToken)

  // Get fresh access token
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!isConfigured) return null

    // Return cached token if still valid
    if (accessTokenRef.current && Date.now() < tokenExpiryRef.current) {
      return accessTokenRef.current
    }

    try {
      const { clientId, clientSecret, refreshToken } = spotify
      const basicAuth = btoa(`${clientId}:${clientSecret}`)

      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to refresh token')
      }

      const data = await response.json()
      accessTokenRef.current = data.access_token
      tokenExpiryRef.current = Date.now() + (data.expires_in - 60) * 1000
      return data.access_token
    } catch (err) {
      console.error('[SpotifyPlayer] Failed to get access token:', err)
      return null
    }
  }, [isConfigured, spotify])

  // Check if user has Premium
  const checkPremiumStatus = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return

    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setIsPremium(data.product === 'premium')
        if (data.product !== 'premium') {
          setError('Spotify Premium required for full playback')
        }
      }
    } catch (err) {
      console.error('[SpotifyPlayer] Failed to check premium status:', err)
    }
  }, [getAccessToken])

  // Load SDK script
  useEffect(() => {
    if (!isConfigured) return

    // Check premium status first
    checkPremiumStatus()

    // Check if script already loaded
    if (window.Spotify) {
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src="${SDK_URL}"]`)
    if (existingScript) return

    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    document.body.appendChild(script)

    return () => {
      // Cleanup is handled by disconnect
    }
  }, [isConfigured, checkPremiumStatus])

  // Initialize player when SDK is ready
  useEffect(() => {
    if (!isConfigured || isPremium === false) return

    const initPlayer = () => {
      if (!window.Spotify || playerRef.current) return

      console.log('[SpotifyPlayer] Initializing player...')

      const player = new window.Spotify.Player({
        name: 'Music League Strategist',
        getOAuthToken: async (cb) => {
          const token = await getAccessToken()
          if (token) cb(token)
        },
        volume: 0.5,
      })

      // Error handling
      player.addListener('initialization_error', (e: unknown) => {
        const event = e as SpotifyErrorEvent
        console.error('[SpotifyPlayer] Initialization error:', event.message)
        setError(`Initialization failed: ${event.message}`)
      })

      player.addListener('authentication_error', (e: unknown) => {
        const event = e as SpotifyErrorEvent
        console.error('[SpotifyPlayer] Authentication error:', event.message)
        setError(`Authentication failed: ${event.message}`)
      })

      player.addListener('account_error', (e: unknown) => {
        const event = e as SpotifyErrorEvent
        console.error('[SpotifyPlayer] Account error:', event.message)
        setError('Premium account required for playback')
        setIsPremium(false)
      })

      player.addListener('playback_error', (e: unknown) => {
        const event = e as SpotifyErrorEvent
        console.error('[SpotifyPlayer] Playback error:', event.message)
        setError(`Playback error: ${event.message}`)
      })

      // Ready
      player.addListener('ready', (e: unknown) => {
        const event = e as SpotifyReadyEvent
        console.log('[SpotifyPlayer] Ready with device ID:', event.device_id)
        setDeviceId(event.device_id)
        setIsReady(true)
        setError(null)
      })

      // Not ready
      player.addListener('not_ready', (e: unknown) => {
        const event = e as SpotifyReadyEvent
        console.log('[SpotifyPlayer] Device went offline:', event.device_id)
        setIsReady(false)
      })

      // Playback state changes
      player.addListener('player_state_changed', (state: unknown) => {
        const playbackState = state as SpotifyPlaybackState | null
        if (!playbackState) {
          setIsPlaying(false)
          setIsPaused(false)
          setCurrentTrack(null)
          return
        }

        setIsPlaying(!playbackState.paused)
        setIsPaused(playbackState.paused)
        setCurrentTrack(playbackState.track_window.current_track)
        setPosition(playbackState.position)
        setDuration(playbackState.duration)
      })

      // Connect
      player.connect().then((success) => {
        if (success) {
          console.log('[SpotifyPlayer] Connected successfully')
        } else {
          console.error('[SpotifyPlayer] Failed to connect')
          setError('Failed to connect to Spotify')
        }
      })

      playerRef.current = player
    }

    // If SDK already loaded, init immediately
    if (window.Spotify) {
      initPlayer()
    } else {
      // Wait for SDK to load
      window.onSpotifyWebPlaybackSDKReady = initPlayer
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect()
        playerRef.current = null
      }
    }
  }, [isConfigured, isPremium, getAccessToken])

  // Transfer playback to this device
  const transferPlayback = useCallback(async (): Promise<boolean> => {
    if (!deviceId) {
      setError('Player not ready')
      return false
    }

    setIsTransferring(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setError('Failed to get access token')
        return false
      }

      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false, // Don't auto-play, just transfer
        }),
      })

      if (response.status === 204 || response.ok) {
        console.log('[SpotifyPlayer] Playback transferred successfully')
        setError(null)
        return true
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[SpotifyPlayer] Transfer failed:', errorData)
        setError(errorData.error?.message || 'Failed to transfer playback')
        return false
      }
    } catch (err) {
      console.error('[SpotifyPlayer] Transfer error:', err)
      setError('Failed to transfer playback')
      return false
    } finally {
      setIsTransferring(false)
    }
  }, [deviceId, getAccessToken])

  // Play a track
  const play = useCallback(async (spotifyUri?: string) => {
    if (!deviceId) {
      setError('Player not ready')
      return
    }

    const token = await getAccessToken()
    if (!token) return

    try {
      const body: { device_id: string; uris?: string[] } = { device_id: deviceId }
      if (spotifyUri) {
        body.uris = [spotifyUri]
      }

      const response = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || 'Playback failed')
      }
    } catch (err) {
      console.error('[SpotifyPlayer] Play error:', err)
      setError(err instanceof Error ? err.message : 'Playback failed')
    }
  }, [deviceId, getAccessToken])

  // Pause
  const pause = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.pause()
  }, [])

  // Resume
  const resume = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.resume()
  }, [])

  // Toggle play/pause
  const togglePlay = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.togglePlay()
  }, [])

  // Seek
  const seek = useCallback(async (positionMs: number) => {
    if (!playerRef.current) return
    await playerRef.current.seek(positionMs)
  }, [])

  // Previous track
  const previousTrack = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.previousTrack()
  }, [])

  // Next track
  const nextTrack = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.nextTrack()
  }, [])

  // Set volume
  const setVolume = useCallback(async (vol: number) => {
    if (!playerRef.current) return
    await playerRef.current.setVolume(vol)
    setVolumeState(vol)
  }, [])

  // Disconnect
  const disconnect = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.disconnect()
      playerRef.current = null
      setIsReady(false)
      setDeviceId(null)
    }
  }, [])

  return {
    // State
    isReady,
    isPlaying,
    isPaused,
    deviceId,
    currentTrack,
    position,
    duration,
    volume,
    error,
    isTransferring,
    isPremium,
    // Actions
    play,
    pause,
    resume,
    togglePlay,
    seek,
    previousTrack,
    nextTrack,
    setVolume,
    transferPlayback,
    disconnect,
  }
}
