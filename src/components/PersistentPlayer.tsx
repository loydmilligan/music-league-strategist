// PersistentPlayer Component
// A persistent player bar at the bottom of the screen that keeps playing even while working

import { useState, useCallback } from 'react'
import {
  Music,
  ChevronUp,
  ChevronDown,
  X,
  ListMusic,
  Heart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { cn } from '@/lib/utils'

// Extract Spotify track/playlist ID from URL
function extractSpotifyId(url: string): { type: 'track' | 'playlist' | 'album'; id: string } | null {
  try {
    const match = url.match(/spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/)
    if (match) {
      return { type: match[1] as 'track' | 'playlist' | 'album', id: match[2] }
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

interface SpotifyEmbedProps {
  spotifyId: string
  type: 'track' | 'playlist' | 'album'
  height?: number
  compact?: boolean
}

function SpotifyEmbed({ spotifyId, type, height = 152, compact = false }: SpotifyEmbedProps): React.ReactElement {
  const src = `https://open.spotify.com/embed/${type}/${spotifyId}?utm_source=generator&theme=0`

  return (
    <iframe
      src={src}
      width="100%"
      height={compact ? 80 : height}
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title="Spotify Player"
      className="rounded-lg"
    />
  )
}

type PlayerSource = 'theme' | 'liked' | null

interface ActiveTrack {
  id: string
  title: string
  artist: string
  spotifyId: string
  type: 'track' | 'playlist'
}

export function PersistentPlayer(): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeSource, setActiveSource] = useState<PlayerSource>(null)
  const [activeTrack, setActiveTrack] = useState<ActiveTrack | null>(null)

  const activeTheme = useMusicLeagueStore((s) => s.activeTheme)()
  const songsILike = useMusicLeagueStore((s) => s.songsILike)

  const themePlaylistId = activeTheme?.spotifyPlaylist?.playlistId

  // Get songs from active theme funnel with Spotify IDs
  const themeSongs = activeTheme
    ? [
        ...(activeTheme.pick ? [activeTheme.pick] : []),
        ...(activeTheme.finalists || []),
        ...(activeTheme.semifinalists || []),
      ]
        .filter((song) => song.spotifyUri || song.spotifyTrackId)
        .slice(0, 10)
    : []

  // Get Spotify IDs from Songs I Like
  const likedSongsWithSpotify = songsILike
    .filter((song) => song.spotifyUri || song.spotifyTrackId)
    .slice(0, 10)

  const hasThemeContent = themePlaylistId || themeSongs.length > 0
  const hasLikedContent = likedSongsWithSpotify.length > 0
  const hasContent = hasThemeContent || hasLikedContent

  // Play theme playlist or first theme song
  const playTheme = useCallback(() => {
    if (themePlaylistId) {
      setActiveTrack({
        id: 'theme-playlist',
        title: activeTheme?.title || 'Theme Playlist',
        artist: 'Playlist',
        spotifyId: themePlaylistId,
        type: 'playlist',
      })
    } else if (themeSongs.length > 0) {
      const song = themeSongs[0]
      const spotifyId = song.spotifyTrackId || extractSpotifyId(song.spotifyUri || '')?.id
      if (spotifyId) {
        setActiveTrack({
          id: song.id,
          title: song.title,
          artist: song.artist,
          spotifyId,
          type: 'track',
        })
      }
    }
    setActiveSource('theme')
    setIsExpanded(true)
  }, [themePlaylistId, themeSongs, activeTheme])

  // Play first liked song
  const playLiked = useCallback(() => {
    if (likedSongsWithSpotify.length > 0) {
      const song = likedSongsWithSpotify[0]
      const spotifyId = song.spotifyTrackId || extractSpotifyId(song.spotifyUri || '')?.id
      if (spotifyId) {
        setActiveTrack({
          id: song.id,
          title: song.title,
          artist: song.artist,
          spotifyId,
          type: 'track',
        })
        setActiveSource('liked')
        setIsExpanded(true)
      }
    }
  }, [likedSongsWithSpotify])

  // Close player
  const closePlayer = useCallback(() => {
    setActiveTrack(null)
    setActiveSource(null)
    setIsExpanded(false)
  }, [])

  // If no content, don't render
  if (!hasContent) {
    return <></>
  }

  // If no active track, show compact trigger bar
  if (!activeTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t p-2">
        <div className="max-w-screen-xl mx-auto flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={playTheme}
            disabled={!hasThemeContent}
          >
            <ListMusic className="h-4 w-4" />
            <span className="hidden sm:inline">Theme Songs</span>
            <span className="sm:hidden">Theme</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={playLiked}
            disabled={!hasLikedContent}
          >
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Songs I Like</span>
            <span className="sm:hidden">Liked</span>
          </Button>
        </div>
      </div>
    )
  }

  // Active player bar
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t transition-all duration-300',
        isExpanded ? 'max-h-[300px]' : 'max-h-[60px]'
      )}
    >
      {/* Header bar with controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Music className="h-4 w-4 text-green-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{activeTrack.title}</p>
            <p className="text-xs text-muted-foreground truncate">{activeTrack.artist}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Source switcher */}
          <Button
            variant={activeSource === 'theme' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={playTheme}
            disabled={!hasThemeContent}
            title="Play theme songs"
          >
            <ListMusic className="h-4 w-4" />
          </Button>
          <Button
            variant={activeSource === 'liked' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={playLiked}
            disabled={!hasLikedContent}
            title="Play liked songs"
          >
            <Heart className="h-4 w-4" />
          </Button>
          {/* Expand/collapse */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse player' : 'Expand player'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={closePlayer}
            title="Close player"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Spotify embed - always rendered to keep playing */}
      {/* When collapsed, we use a tiny but visible iframe to prevent browser from pausing audio */}
      <div
        className={cn(
          'px-4 transition-all duration-300 overflow-hidden',
          isExpanded ? 'py-2' : 'py-0'
        )}
        style={{ height: isExpanded ? 'auto' : '1px' }}
      >
        <SpotifyEmbed
          spotifyId={activeTrack.spotifyId}
          type={activeTrack.type}
          height={activeTrack.type === 'playlist' ? 200 : 80}
        />
      </div>
    </div>
  )
}
