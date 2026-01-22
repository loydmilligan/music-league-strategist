import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Disc3,
  Music2,
  ListMusic,
  Heart,
  Shuffle,
  Volume2,
  Smartphone,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer'
import type { Song, FunnelTier } from '@/types/musicLeague'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'

type PlaylistSource = 'funnel' | 'liked'

interface PlayerViewProps {
  initialSong?: Song | null
}

// Memoized Spotify embed to prevent reloads
const SpotifyEmbed = memo(function SpotifyEmbed({
  trackId
}: {
  trackId: string
}) {
  return (
    <iframe
      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
      width="100%"
      height="352"
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      className="rounded-2xl"
    />
  )
})

export function PlayerView({ initialSong }: PlayerViewProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<PlaylistSource>('funnel')
  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [isShuffled, setIsShuffled] = useState(false)
  const [useSDKPlayer, setUseSDKPlayer] = useState(false)

  const {
    activeTheme,
    songsILike,
    addToSongsILike,
    removeFromSongsILike
  } = useMusicLeagueStore()

  // Spotify Web Playback SDK
  const spotifyPlayer = useSpotifyPlayer()

  const theme = activeTheme()

  // Get all songs from funnel (ordered by tier)
  const funnelSongs = useMemo(() => {
    if (!theme) return []
    const songs: Song[] = []
    if (theme.pick) songs.push({ ...theme.pick, currentTier: 'pick' as FunnelTier })
    if (theme.finalists) songs.push(...theme.finalists.map(s => ({ ...s, currentTier: 'finalists' as FunnelTier })))
    if (theme.semifinalists) songs.push(...theme.semifinalists.map(s => ({ ...s, currentTier: 'semifinalists' as FunnelTier })))
    if (theme.candidates) songs.push(...theme.candidates.map(s => ({ ...s, currentTier: 'candidates' as FunnelTier })))
    return songs.filter(s => !s.isMuted)
  }, [theme])

  // songsILike is SavedSong[] which extends Song
  const likedSongs = useMemo(() => {
    return songsILike as Song[]
  }, [songsILike])

  const currentPlaylist = activeTab === 'funnel' ? funnelSongs : likedSongs
  const currentSong = currentPlaylist[currentSongIndex] || null

  // Check if current song is liked
  const isCurrentSongLiked = currentSong
    ? songsILike.some(song =>
        song.title === currentSong.title &&
        song.artist === currentSong.artist
      )
    : false

  const handleNext = useCallback(() => {
    if (currentPlaylist.length === 0) return
    setCurrentSongIndex((prev) =>
      prev < currentPlaylist.length - 1 ? prev + 1 : 0
    )
  }, [currentPlaylist.length])

  const handlePrev = useCallback(() => {
    if (currentPlaylist.length === 0) return
    setCurrentSongIndex((prev) =>
      prev > 0 ? prev - 1 : currentPlaylist.length - 1
    )
  }, [currentPlaylist.length])

  const handleSongSelect = useCallback((index: number) => {
    setCurrentSongIndex(index)
  }, [])

  const handleToggleLike = useCallback(() => {
    if (!currentSong) return
    if (isCurrentSongLiked) {
      const item = songsILike.find(
        song =>
          song.title === currentSong.title &&
          song.artist === currentSong.artist
      )
      if (item) removeFromSongsILike(item.id)
    } else {
      addToSongsILike(currentSong, [], 'Added from player')
    }
  }, [currentSong, isCurrentSongLiked, songsILike, addToSongsILike, removeFromSongsILike])

  const handleShuffle = useCallback(() => {
    setIsShuffled(!isShuffled)
    if (!isShuffled && currentPlaylist.length > 1) {
      const randomIndex = Math.floor(Math.random() * currentPlaylist.length)
      setCurrentSongIndex(randomIndex)
    }
  }, [isShuffled, currentPlaylist.length])

  // Track if we've handled the initial song
  const initialSongHandledRef = useRef(false)

  // Effect to handle initialSong - use ref to only run once and schedule update
  useEffect(() => {
    if (initialSong && !initialSongHandledRef.current) {
      const index = currentPlaylist.findIndex(
        s => s.title === initialSong.title && s.artist === initialSong.artist
      )
      if (index >= 0) {
        initialSongHandledRef.current = true
        // Schedule state update to avoid synchronous setState in effect
        queueMicrotask(() => setCurrentSongIndex(index))
      }
    }
  }, [initialSong, currentPlaylist])

  if (currentPlaylist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse-glow">
          <Disc3 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="font-display text-xl mb-2">No Songs Yet</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Add songs to your funnel or liked collection to start playing.
        </p>
      </div>
    )
  }

  // Handle SDK playback
  const handleSDKPlay = useCallback(async () => {
    if (!currentSong?.spotifyUri && !currentSong?.spotifyTrackId) return

    const uri = currentSong.spotifyUri || `spotify:track:${currentSong.spotifyTrackId}`
    await spotifyPlayer.play(uri)
  }, [currentSong, spotifyPlayer])

  const handleTransferAndPlay = useCallback(async () => {
    const success = await spotifyPlayer.transferPlayback()
    if (success) {
      setUseSDKPlayer(true)
      // Play current song after transfer
      if (currentSong?.spotifyTrackId) {
        setTimeout(() => {
          handleSDKPlay()
        }, 500)
      }
    }
  }, [spotifyPlayer, currentSong, handleSDKPlay])

  // Format time for progress display
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Now Playing */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* SDK Player Status Banner */}
        {spotifyPlayer.isReady && !useSDKPlayer && spotifyPlayer.isPremium && (
          <div className="w-full max-w-sm mb-4">
            <Button
              variant="outline"
              className="w-full h-12 gap-2"
              onClick={handleTransferAndPlay}
              disabled={spotifyPlayer.isTransferring}
            >
              {spotifyPlayer.isTransferring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              Play on this device (full tracks)
            </Button>
          </div>
        )}

        {/* SDK Error Banner */}
        {spotifyPlayer.error && (
          <div className="w-full max-w-sm mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {spotifyPlayer.error}
          </div>
        )}

        {/* Album Art / Player */}
        <div className="w-full max-w-sm mb-6">
          {useSDKPlayer && spotifyPlayer.isPlaying && spotifyPlayer.currentTrack ? (
            // SDK Player - Album Art from current track
            <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
              {spotifyPlayer.currentTrack.album.images[0] ? (
                <img
                  src={spotifyPlayer.currentTrack.album.images[0].url}
                  alt={spotifyPlayer.currentTrack.album.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music2 className="h-24 w-24 text-primary/50" />
                </div>
              )}
            </div>
          ) : currentSong?.spotifyTrackId && !useSDKPlayer ? (
            // Embed player (fallback)
            <SpotifyEmbed
              trackId={currentSong.spotifyTrackId}
            />
          ) : (
            // No song - vinyl animation
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <div className="vinyl-ring h-48 w-48 animate-vinyl-spin">
                <div className="absolute inset-12 rounded-full bg-background flex items-center justify-center">
                  <Music2 className="h-8 w-8 text-primary" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Song Info */}
        <div className="text-center mb-6 w-full max-w-sm">
          {useSDKPlayer && spotifyPlayer.currentTrack ? (
            <>
              <h2 className="font-display text-xl truncate">{spotifyPlayer.currentTrack.name}</h2>
              <p className="text-muted-foreground truncate">
                {spotifyPlayer.currentTrack.artists.map(a => a.name).join(', ')}
              </p>
              <p className="text-sm text-muted-foreground/60 truncate mt-1">
                {spotifyPlayer.currentTrack.album.name}
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl truncate">{currentSong?.title}</h2>
              <p className="text-muted-foreground truncate">{currentSong?.artist}</p>
              {currentSong?.album && (
                <p className="text-sm text-muted-foreground/60 truncate mt-1">
                  {currentSong.album} {currentSong.year && `(${currentSong.year})`}
                </p>
              )}
            </>
          )}
        </div>

        {/* Progress Bar (SDK only) */}
        {useSDKPlayer && spotifyPlayer.duration > 0 && (
          <div className="w-full max-w-sm mb-4">
            <Slider
              value={[spotifyPlayer.position]}
              max={spotifyPlayer.duration}
              step={1000}
              onValueChange={([value]) => spotifyPlayer.seek(value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{formatTime(spotifyPlayer.position)}</span>
              <span>{formatTime(spotifyPlayer.duration)}</span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-12 w-12 rounded-full',
              isShuffled && 'text-primary'
            )}
            onClick={handleShuffle}
          >
            <Shuffle className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={useSDKPlayer ? spotifyPlayer.previousTrack : handlePrev}
          >
            <SkipBack className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            className="h-16 w-16 rounded-full glow-primary"
            onClick={useSDKPlayer ? spotifyPlayer.togglePlay : handleSDKPlay}
          >
            {useSDKPlayer && spotifyPlayer.isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={useSDKPlayer ? spotifyPlayer.nextTrack : handleNext}
          >
            <SkipForward className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-12 w-12 rounded-full',
              isCurrentSongLiked && 'text-destructive'
            )}
            onClick={handleToggleLike}
          >
            <Heart className={cn(
              'h-5 w-5',
              isCurrentSongLiked && 'fill-current'
            )} />
          </Button>
        </div>

        {/* Volume Control (SDK only) */}
        {useSDKPlayer && (
          <div className="flex items-center gap-3 w-full max-w-sm mt-4">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[spotifyPlayer.volume * 100]}
              max={100}
              step={1}
              onValueChange={([value]) => spotifyPlayer.setVolume(value / 100)}
              className="flex-1"
            />
          </div>
        )}
      </div>

      {/* Playlist Selector */}
      <div className="border-t bg-card/50 backdrop-blur-sm">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PlaylistSource)}>
          <TabsList className="w-full justify-around bg-transparent h-12">
            <TabsTrigger
              value="funnel"
              className="flex-1 data-[state=active]:bg-primary/10 gap-2"
            >
              <ListMusic className="h-4 w-4" />
              Funnel ({funnelSongs.length})
            </TabsTrigger>
            <TabsTrigger
              value="liked"
              className="flex-1 data-[state=active]:bg-primary/10 gap-2"
            >
              <Heart className="h-4 w-4" />
              Liked ({likedSongs.length})
            </TabsTrigger>
          </TabsList>

          <div className="h-[180px]">
            <TabsContent value="funnel" className="m-0 h-full">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {funnelSongs.map((song, index) => (
                    <SongListItem
                      key={song.id}
                      song={song}
                      isActive={index === currentSongIndex && activeTab === 'funnel'}
                      tier={song.currentTier}
                      onClick={() => handleSongSelect(index)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="liked" className="m-0 h-full">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {likedSongs.map((song, index) => (
                    <SongListItem
                      key={song.id}
                      song={song}
                      isActive={index === currentSongIndex && activeTab === 'liked'}
                      onClick={() => handleSongSelect(index)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

interface SongListItemProps {
  song: Song
  isActive: boolean
  tier?: FunnelTier
  onClick: () => void
}

function SongListItem({ song, isActive, tier, onClick }: SongListItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-lg',
        'transition-all duration-200 text-left',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted/50 active:bg-muted'
      )}
    >
      {isActive && (
        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Play className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm truncate',
          isActive && 'font-medium'
        )}>
          {song.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>
      {tier && (
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded',
          `tier-badge-${tier}`
        )}>
          {tier === 'pick' ? 'P' : tier.charAt(0).toUpperCase()}
        </span>
      )}
    </button>
  )
}
