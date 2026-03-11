/**
 * Music Assistant API Service
 * Integrates with Lyric Scroll API for Home Assistant Music Assistant playback
 */

import type { Song } from '../types/musicLeague'

const MA_API_URL = 'http://192.168.6.8:8099'
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
  const response = await fetch(`${MA_API_URL}/api/ma/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entity_id: entityId,
      tracks,
      enqueue,
    }),
  })

  if (!response.ok) {
    throw new Error(`Music Assistant API error: ${response.status}`)
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
