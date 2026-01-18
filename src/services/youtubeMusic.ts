// YouTube Music API Service for playlist creation and video ID lookup
import { useSettingsStore } from '@/stores/settingsStore'
import type { Song } from '@/types/musicLeague'

interface YouTubeSearchResult {
  videoId: string
  title: string
  channelTitle: string
}

interface YouTubeAccessToken {
  access_token: string
  expires_in: number
  token_type: string
}

class YouTubeMusicService {
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  private get config() {
    return useSettingsStore.getState().youtubeMusic
  }

  private get isConfigured(): boolean {
    const { clientId, clientSecret, refreshToken } = this.config
    return Boolean(clientId && clientSecret && refreshToken)
  }

  // Refresh the access token using the refresh token
  private async refreshAccessToken(): Promise<string> {
    const { clientId, clientSecret, refreshToken } = this.config

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('YouTube Music not configured. Add credentials in Settings.')
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to refresh YouTube token: ${error}`)
    }

    const data: YouTubeAccessToken = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000 // 60s buffer
    return this.accessToken
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }
    return this.refreshAccessToken()
  }

  // Search for a song and get its video ID
  async searchVideo(song: Song): Promise<YouTubeSearchResult | null> {
    const query = `${song.title} ${song.artist} official`

    const token = await this.getAccessToken()
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      videoCategoryId: '10', // Music category
      maxResults: '1',
    })

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      console.error('YouTube search failed:', await response.text())
      return null
    }

    const data = await response.json()
    const item = data.items?.[0]

    if (!item) return null

    return {
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
    }
  }

  // Search for video IDs for all songs
  async enrichSongsWithVideoIds(songs: Song[]): Promise<Song[]> {
    if (!this.isConfigured) {
      // If not configured, just return songs as-is
      return songs
    }

    const enrichedSongs: Song[] = []

    for (const song of songs) {
      try {
        const result = await this.searchVideo(song)
        if (result) {
          enrichedSongs.push({
            ...song,
            youtubeVideoId: result.videoId,
            youtubeUrl: `https://www.youtube.com/watch?v=${result.videoId}`,
          })
        } else {
          enrichedSongs.push(song)
        }
      } catch (error) {
        console.error(`Failed to search for ${song.title}:`, error)
        enrichedSongs.push(song)
      }
      // Rate limit - 100ms between requests
      await new Promise((r) => setTimeout(r, 100))
    }

    return enrichedSongs
  }

  // Create a playlist with the given songs
  async createPlaylist(
    title: string,
    description: string,
    songs: Song[]
  ): Promise<{ playlistId: string; playlistUrl: string }> {
    if (!this.isConfigured) {
      throw new Error('YouTube Music not configured. Add credentials in Settings.')
    }

    const token = await this.getAccessToken()

    // Create the playlist
    const createResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
          },
          status: {
            privacyStatus: 'private',
          },
        }),
      }
    )

    if (!createResponse.ok) {
      throw new Error(`Failed to create playlist: ${await createResponse.text()}`)
    }

    const playlist = await createResponse.json()
    const playlistId = playlist.id

    // Add songs to the playlist
    for (const song of songs) {
      let videoId = song.youtubeVideoId

      // If no video ID, search for it
      if (!videoId) {
        const result = await this.searchVideo(song)
        videoId = result?.videoId
      }

      if (!videoId) {
        console.warn(`Skipping ${song.title} - no video found`)
        continue
      }

      await fetch(
        'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            snippet: {
              playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId,
              },
            },
          }),
        }
      )

      // Rate limit
      await new Promise((r) => setTimeout(r, 100))
    }

    return {
      playlistId,
      playlistUrl: `https://music.youtube.com/playlist?list=${playlistId}`,
    }
  }

  // Check if the service is configured
  checkConfiguration(): { configured: boolean; error?: string } {
    const { clientId, clientSecret, refreshToken } = this.config

    if (!clientId) return { configured: false, error: 'Missing YouTube Client ID' }
    if (!clientSecret) return { configured: false, error: 'Missing YouTube Client Secret' }
    if (!refreshToken) return { configured: false, error: 'Missing YouTube Refresh Token' }

    return { configured: true }
  }
}

export const youtubeMusicService = new YouTubeMusicService()
