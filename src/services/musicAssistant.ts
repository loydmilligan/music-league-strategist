/**
 * Music Assistant API Service
 * Integrates with Lyric Scroll API for Home Assistant Music Assistant playback
 * Proxied through backend to avoid CORS/network issues
 */

import type { Song } from '../types/musicLeague'

const API_BASE = '/api/ml'
const DEFAULT_PLAYER = 'media_player.office_2'

export interface QueueResult {
  success: boolean
  entity_id: string
  added_count: number
  missing_count: number
  added: Array<{
    query: string
    uri: string
    name: string
    artist: string
  }>
  missing: string[]
}

/**
 * Format a song for Music Assistant queue
 * Uses "Artist - Title" format for best search results
 */
export function formatTrack(song: Song | { artist: string; title: string }): string {
  return `${song.artist} - ${song.title}`
}

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  const authData = localStorage.getItem('auth-storage')
  if (!authData) return null
  try {
    const parsed = JSON.parse(authData)
    return parsed.state?.accessToken || null
  } catch {
    return null
  }
}

/**
 * Queue tracks on Music Assistant player
 * @param tracks Array of track queries in "Artist - Song Title" format
 * @param enqueue Queue behavior: 'play' (replace), 'add' (append), 'next' (play after current)
 * @param entityId Player entity ID (must end in _2 for Music Assistant)
 */
export async function queueTracks(
  tracks: string[],
  enqueue: 'play' | 'add' | 'next' = 'play',
  entityId: string = DEFAULT_PLAYER
): Promise<QueueResult> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_BASE}/ma/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      entity_id: entityId,
      tracks,
      enqueue,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Music Assistant API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Queue songs from the funnel
 * Convenience wrapper that formats Song objects
 */
export async function queueSongs(
  songs: Array<Song | { artist: string; title: string }>,
  enqueue: 'play' | 'add' | 'next' = 'play',
  entityId: string = DEFAULT_PLAYER
): Promise<QueueResult> {
  const tracks = songs.map(formatTrack)
  return queueTracks(tracks, enqueue, entityId)
}

/**
 * Queue a single song
 */
export async function playSong(
  song: Song | { artist: string; title: string },
  entityId: string = DEFAULT_PLAYER
): Promise<QueueResult> {
  return queueSongs([song], 'play', entityId)
}

/**
 * Add a song to play next (after current track)
 */
export async function playNext(
  song: Song | { artist: string; title: string },
  entityId: string = DEFAULT_PLAYER
): Promise<QueueResult> {
  return queueSongs([song], 'next', entityId)
}
