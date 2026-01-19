import { useState } from 'react'
import { Music, ChevronDown, ChevronUp, ListMusic, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

function SpotifyEmbed({ spotifyId, type, height = 152 }: SpotifyEmbedProps): React.ReactElement {
  const src = `https://open.spotify.com/embed/${type}/${spotifyId}?utm_source=generator&theme=0`

  return (
    <iframe
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
}

export function PlayerPanel(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'theme' | 'liked'>('theme')

  const activeTheme = useMusicLeagueStore((s) => s.activeTheme)()
  const songsILike = useMusicLeagueStore((s) => s.songsILike)

  const themePlaylistId = activeTheme?.spotifyPlaylist?.playlistId

  // Get Spotify IDs from Songs I Like
  const likedSongsWithSpotify = songsILike
    .filter((song) => song.spotifyUri || song.spotifyTrackId)
    .slice(0, 10) // Limit to 10 for performance

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

  const hasThemeContent = themePlaylistId || themeSongs.length > 0
  const hasLikedContent = likedSongsWithSpotify.length > 0
  const hasContent = hasThemeContent || hasLikedContent

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 min-w-[44px] min-h-[44px]',
            hasContent && 'text-green-500'
          )}
          title={hasContent ? 'Open music player' : 'No music to play'}
        >
          <Music className="h-4 w-4" />
        </Button>
      </SheetTrigger>

      {/* Use side="bottom" for mobile-friendly slide-up behavior */}
      <SheetContent
        side="bottom"
        className="h-auto max-h-[80vh] rounded-t-xl sm:max-h-[500px]"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Music className="h-4 w-4" />
            Music Player
          </SheetTitle>
        </SheetHeader>

        {!hasContent ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No music available yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add songs to your funnel or save songs you like
            </p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'theme' | 'liked')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger
                value="theme"
                disabled={!hasThemeContent}
                className="gap-1.5 min-h-[44px]"
              >
                <ListMusic className="h-4 w-4" />
                <span className="hidden sm:inline">Theme Songs</span>
                <span className="sm:hidden">Theme</span>
              </TabsTrigger>
              <TabsTrigger
                value="liked"
                disabled={!hasLikedContent}
                className="gap-1.5 min-h-[44px]"
              >
                <Heart className="h-4 w-4" />
                <span className="hidden sm:inline">Songs I Like</span>
                <span className="sm:hidden">Liked</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="theme" className="mt-4 space-y-4">
              {themePlaylistId ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Playing: {activeTheme?.title} Playlist
                  </p>
                  <SpotifyEmbed
                    spotifyId={themePlaylistId}
                    type="playlist"
                    height={280}
                  />
                </div>
              ) : themeSongs.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Songs from: {activeTheme?.title}
                  </p>
                  {/* Show first song larger, rest smaller */}
                  {themeSongs.slice(0, 1).map((song) => {
                    const spotifyId = song.spotifyTrackId || extractSpotifyId(song.spotifyUri || '')?.id
                    if (!spotifyId) return null
                    return (
                      <div key={song.id}>
                        <p className="text-xs text-muted-foreground mb-1 truncate">
                          {song.title} - {song.artist}
                        </p>
                        <SpotifyEmbed spotifyId={spotifyId} type="track" height={80} />
                      </div>
                    )
                  })}
                  {themeSongs.length > 1 && (
                    <details className="group">
                      <summary className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                        <ChevronDown className="h-3 w-3 group-open:hidden" />
                        <ChevronUp className="h-3 w-3 hidden group-open:block" />
                        {themeSongs.length - 1} more songs
                      </summary>
                      <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                        {themeSongs.slice(1).map((song) => {
                          const spotifyId = song.spotifyTrackId || extractSpotifyId(song.spotifyUri || '')?.id
                          if (!spotifyId) return null
                          return (
                            <div key={song.id}>
                              <p className="text-xs text-muted-foreground mb-1 truncate">
                                {song.title} - {song.artist}
                              </p>
                              <SpotifyEmbed spotifyId={spotifyId} type="track" height={80} />
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No songs with Spotify links in this theme
                </div>
              )}
            </TabsContent>

            <TabsContent value="liked" className="mt-4 space-y-4">
              {likedSongsWithSpotify.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Your saved songs ({likedSongsWithSpotify.length})
                  </p>
                  {/* Show first song larger */}
                  {likedSongsWithSpotify.slice(0, 1).map((song) => {
                    const spotifyId = song.spotifyTrackId || extractSpotifyId(song.spotifyUri || '')?.id
                    if (!spotifyId) return null
                    return (
                      <div key={song.id}>
                        <p className="text-xs text-muted-foreground mb-1 truncate">
                          {song.title} - {song.artist}
                        </p>
                        <SpotifyEmbed spotifyId={spotifyId} type="track" height={80} />
                      </div>
                    )
                  })}
                  {likedSongsWithSpotify.length > 1 && (
                    <details className="group">
                      <summary className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                        <ChevronDown className="h-3 w-3 group-open:hidden" />
                        <ChevronUp className="h-3 w-3 hidden group-open:block" />
                        {likedSongsWithSpotify.length - 1} more songs
                      </summary>
                      <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                        {likedSongsWithSpotify.slice(1).map((song) => {
                          const spotifyId = song.spotifyTrackId || extractSpotifyId(song.spotifyUri || '')?.id
                          if (!spotifyId) return null
                          return (
                            <div key={song.id}>
                              <p className="text-xs text-muted-foreground mb-1 truncate">
                                {song.title} - {song.artist}
                              </p>
                              <SpotifyEmbed spotifyId={spotifyId} type="track" height={80} />
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No saved songs with Spotify links
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}
