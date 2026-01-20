// PersistentPlayer Component
// A persistent player bar at the bottom of the screen that keeps playing even while working

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
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
}

// Memoized Spotify embed that only re-renders when spotifyId or type changes
const SpotifyEmbed = memo(function SpotifyEmbed({ spotifyId, type, height = 152 }: SpotifyEmbedProps) {
  const src = `https://open.spotify.com/embed/${type}/${spotifyId}?utm_source=generator&theme=0`

  return (
    <iframe
      key={`spotify-${spotifyId}`}
      src={src}
      width="100%"
      height={height}
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title="Spotify Player"
      className="rounded-lg"
    />
  )
}, (prevProps, nextProps) => {
  // Only re-render if spotifyId or type changes
  return prevProps.spotifyId === nextProps.spotifyId && prevProps.type === nextProps.type
})

type PlayerSource = 'theme' | 'liked' | null

interface ActiveTrack {
  id: string
  title: string
  artist: string
  spotifyId: string
  type: 'track' | 'playlist'
}

// Separate component for the player controls to isolate re-renders
const PlayerControls = memo(function PlayerControls({
  activeTrack,
  activeSource,
  isExpanded,
  hasThemeContent,
  hasLikedContent,
  onPlayTheme,
  onPlayLiked,
  onToggleExpand,
  onClose,
}: {
  activeTrack: ActiveTrack
  activeSource: PlayerSource
  isExpanded: boolean
  hasThemeContent: boolean
  hasLikedContent: boolean
  onPlayTheme: () => void
  onPlayLiked: () => void
  onToggleExpand: () => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Music className="h-4 w-4 text-green-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{activeTrack.title}</p>
          <p className="text-xs text-muted-foreground truncate">{activeTrack.artist}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant={activeSource === 'theme' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={onPlayTheme}
          disabled={!hasThemeContent}
          title="Play theme songs"
        >
          <ListMusic className="h-4 w-4" />
        </Button>
        <Button
          variant={activeSource === 'liked' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={onPlayLiked}
          disabled={!hasLikedContent}
          title="Play liked songs"
        >
          <Heart className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleExpand}
          title={isExpanded ? 'Collapse player' : 'Expand player'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          title="Close player"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
})

export function PersistentPlayer(): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeSource, setActiveSource] = useState<PlayerSource>(null)
  const [activeTrack, setActiveTrack] = useState<ActiveTrack | null>(null)

  // Use refs to store content availability without causing re-renders
  const contentRef = useRef<{
    themePlaylistId: string | undefined
    themeSongs: Array<{ id: string; title: string; artist: string; spotifyTrackId?: string; spotifyUri?: string }>
    likedSongs: Array<{ id: string; title: string; artist: string; spotifyTrackId?: string; spotifyUri?: string }>
  }>({
    themePlaylistId: undefined,
    themeSongs: [],
    likedSongs: [],
  })

  // Subscribe to store but only update refs, not state
  const themes = useMusicLeagueStore((s) => s.themes)
  const activeThemeId = useMusicLeagueStore((s) => s.activeThemeId)
  const songsILike = useMusicLeagueStore((s) => s.songsILike)

  // Memoize content calculations
  const { hasThemeContent, hasLikedContent, hasContent, themePlaylistId, themeSongs, likedSongsWithSpotify } = useMemo(() => {
    const activeTheme = themes.find((t) => t.id === activeThemeId)
    const playlistId = activeTheme?.spotifyPlaylist?.playlistId

    const songs = activeTheme
      ? [
          ...(activeTheme.pick ? [activeTheme.pick] : []),
          ...(activeTheme.finalists || []),
          ...(activeTheme.semifinalists || []),
        ]
          .filter((song) => song.spotifyUri || song.spotifyTrackId)
          .slice(0, 10)
      : []

    const likedSongs = songsILike
      .filter((song) => song.spotifyUri || song.spotifyTrackId)
      .slice(0, 10)

    const hasTheme = !!playlistId || songs.length > 0
    const hasLiked = likedSongs.length > 0

    return {
      hasThemeContent: hasTheme,
      hasLikedContent: hasLiked,
      hasContent: hasTheme || hasLiked,
      themePlaylistId: playlistId,
      themeSongs: songs,
      likedSongsWithSpotify: likedSongs,
    }
  }, [themes, activeThemeId, songsILike])

  // Update refs in useEffect (not during render)
  useEffect(() => {
    contentRef.current = {
      themePlaylistId,
      themeSongs,
      likedSongs: likedSongsWithSpotify,
    }
  }, [themePlaylistId, themeSongs, likedSongsWithSpotify])

  // Play theme playlist or first theme song
  const playTheme = useCallback(() => {
    const { themePlaylistId, themeSongs } = contentRef.current
    const activeTheme = themes.find((t) => t.id === activeThemeId)

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
  }, [themes, activeThemeId])

  // Play first liked song
  const playLiked = useCallback(() => {
    const { likedSongs } = contentRef.current
    if (likedSongs.length > 0) {
      const song = likedSongs[0]
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
  }, [])

  // Close player
  const closePlayer = useCallback(() => {
    setActiveTrack(null)
    setActiveSource(null)
    setIsExpanded(false)
  }, [])

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev)
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

  // Active player bar - the iframe is always rendered to maintain playback
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t transition-all duration-300',
        isExpanded ? 'max-h-[300px]' : 'max-h-[60px]'
      )}
    >
      {/* Header bar with controls */}
      <PlayerControls
        activeTrack={activeTrack}
        activeSource={activeSource}
        isExpanded={isExpanded}
        hasThemeContent={hasThemeContent}
        hasLikedContent={hasLikedContent}
        onPlayTheme={playTheme}
        onPlayLiked={playLiked}
        onToggleExpand={toggleExpand}
        onClose={closePlayer}
      />

      {/* Spotify embed - always rendered to keep playing */}
      {/* Use a single iframe that stays in DOM, just visually hidden when collapsed */}
      <div
        className={cn(
          'transition-all duration-300 overflow-hidden',
          isExpanded ? 'px-4 py-2 h-auto' : 'h-[1px] opacity-0 pointer-events-none'
        )}
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
