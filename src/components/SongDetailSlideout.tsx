import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Music,
  Star,
  Calendar,
  Disc,
  ExternalLink,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Youtube,
  Play,
  RefreshCw,
  Pencil,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { openRouterService } from '@/services/openrouter'
import { spotifyService } from '@/services/spotify'
import type { Song, SongRatings } from '@/types/musicLeague'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { YouTubePopoutModal } from './YouTubePopoutModal'

interface SongDetailSlideoutProps {
  song: Song | null
  themeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// 5-star rating component
interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  label: string
}

function StarRating({ value, onChange, label }: StarRatingProps): React.ReactElement {
  const [hoverValue, setHoverValue] = useState<number | null>(null)

  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-0.5 hover:scale-110 transition-transform"
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(null)}
            onClick={() => onChange(value === star ? 0 : star)}
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                (hoverValue !== null ? star <= hoverValue : star <= value)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground'
              )}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">{value}/5</span>
        )}
      </div>
    </div>
  )
}

// YouTube button component (opens popout)
interface YouTubeButtonProps {
  videoId?: string
  searchQuery: string
  onOpenPopout: () => void
}

function YouTubeButton({ videoId, searchQuery, onOpenPopout }: YouTubeButtonProps): React.ReactElement {
  const hasVideoId = !!videoId
  const youtubeUrl = hasVideoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`

  if (!hasVideoId) {
    return (
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded border p-3 hover:bg-accent/50 transition-colors"
      >
        <Youtube className="h-5 w-5 text-red-500" />
        <span className="text-sm">Search on YouTube</span>
        <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
      </a>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={onOpenPopout}
        className="flex items-center gap-2 w-full rounded border p-3 hover:bg-accent/50 transition-colors"
      >
        <Youtube className="h-5 w-5 text-red-500" />
        <span className="text-sm">Play on YouTube</span>
        <Play className="h-3 w-3 ml-auto text-muted-foreground" />
      </button>
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-3 w-3" />
        Open in YouTube
      </a>
    </div>
  )
}

// Spotify embed component
function SpotifyEmbed({ trackId, searchQuery }: { trackId?: string; searchQuery: string }): React.ReactElement {
  const hasTrackId = !!trackId
  const spotifyUrl = hasTrackId
    ? `https://open.spotify.com/track/${trackId}`
    : `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}`

  if (!hasTrackId) {
    return (
      <a
        href={spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded border p-3 hover:bg-accent/50 transition-colors"
      >
        <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        <span className="text-sm">Search on Spotify</span>
        <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
      </a>
    )
  }

  return (
    <div className="space-y-2">
      <div className="w-full rounded overflow-hidden">
        <iframe
          style={{ borderRadius: '12px' }}
          src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </div>
      <a
        href={spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-3 w-3" />
        Open in Spotify
      </a>
    </div>
  )
}

export function SongDetailSlideout({
  song,
  themeId,
  open,
  onOpenChange,
}: SongDetailSlideoutProps): React.ReactElement {
  const { updateSongInTheme } = useMusicLeagueStore()
  const openRouterKey = useSettingsStore((s) => s.openRouterKey)
  const defaultModel = useSettingsStore((s) => s.defaultModel)

  const [notes, setNotes] = useState(song?.userNotes || '')
  const [themeRating, setThemeRating] = useState(song?.ratings?.theme || 0)
  const [generalRating, setGeneralRating] = useState(song?.ratings?.general || 0)
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [aiDescription, setAiDescription] = useState(song?.aiDescription || '')
  const [aiExpanded, setAiExpanded] = useState(false)
  const [notesEditable, setNotesEditable] = useState(true)
  const [youtubePopoutOpen, setYoutubePopoutOpen] = useState(false)
  const [enrichedSpotifyId, setEnrichedSpotifyId] = useState<string | undefined>(undefined)
  const [enrichedYoutubeId, setEnrichedYoutubeId] = useState<string | undefined>(undefined)
  const [isEnriching, setIsEnriching] = useState(false)

  // Retrigger search state
  const [isEditingSearch, setIsEditingSearch] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [isRetriggering, setIsRetriggering] = useState(false)

  // Reset state when song changes
  useEffect(() => {
    if (song) {
      setNotes(song.userNotes || '')
      setThemeRating(song.ratings?.theme || 0)
      setGeneralRating(song.ratings?.general || 0)
      setAiDescription(song.aiDescription || '')
      setAiExpanded(false)
      setNotesEditable(true)
      setEnrichedSpotifyId(undefined)
      setEnrichedYoutubeId(undefined)
      setYoutubePopoutOpen(false)
      // Reset retrigger edit state
      setIsEditingSearch(false)
      setEditTitle(song.title)
      setEditArtist(song.artist)
      setIsRetriggering(false)
    }
  }, [song?.id])

  // Cross-platform enrichment via Songlink
  useEffect(() => {
    if (!song || !open) return

    const hasSpotify = !!song.spotifyTrackId
    const hasYoutube = !!song.youtubeVideoId

    // If we have both, no enrichment needed
    if (hasSpotify && hasYoutube) return

    // If we have neither, we can't enrich
    if (!hasSpotify && !hasYoutube) return

    const enrichLinks = async () => {
      setIsEnriching(true)
      try {
        let sourceUrl: string | undefined

        if (hasSpotify && song.spotifyTrackId) {
          sourceUrl = `https://open.spotify.com/track/${song.spotifyTrackId}`
        } else if (hasYoutube && song.youtubeVideoId) {
          sourceUrl = `https://www.youtube.com/watch?v=${song.youtubeVideoId}`
        }

        if (sourceUrl) {
          const links = await spotifyService.getCrossPlatformLinks(sourceUrl)

          if (!hasSpotify && links.spotify) {
            setEnrichedSpotifyId(links.spotify.trackId)
            // Also update the song in the store
            if (themeId) {
              updateSongInTheme(themeId, song.id, {
                spotifyTrackId: links.spotify.trackId,
                spotifyUri: links.spotify.uri,
              })
            }
          }

          if (!hasYoutube && links.youtube) {
            setEnrichedYoutubeId(links.youtube.videoId)
            // Also update the song in the store
            if (themeId) {
              updateSongInTheme(themeId, song.id, {
                youtubeVideoId: links.youtube.videoId,
                youtubeUrl: links.youtube.url,
              })
            }
          }
        }
      } catch (error) {
        console.error('[Songlink] Failed to enrich cross-platform links:', error)
      } finally {
        setIsEnriching(false)
      }
    }

    enrichLinks()
  }, [song?.id, song?.spotifyTrackId, song?.youtubeVideoId, open, themeId, updateSongInTheme])

  // Save notes on change (debounced save happens on blur)
  const handleSaveNotes = useCallback(() => {
    if (!song || !themeId) return
    updateSongInTheme(themeId, song.id, { userNotes: notes })
  }, [song, themeId, notes, updateSongInTheme])

  // Save ratings immediately
  const handleThemeRatingChange = useCallback((value: number) => {
    setThemeRating(value)
    if (!song || !themeId) return
    const newRatings: SongRatings = {
      theme: value,
      general: generalRating,
    }
    updateSongInTheme(themeId, song.id, { ratings: newRatings })
  }, [song, themeId, generalRating, updateSongInTheme])

  const handleGeneralRatingChange = useCallback((value: number) => {
    setGeneralRating(value)
    if (!song || !themeId) return
    const newRatings: SongRatings = {
      theme: themeRating,
      general: value,
    }
    updateSongInTheme(themeId, song.id, { ratings: newRatings })
  }, [song, themeId, themeRating, updateSongInTheme])

  // Fetch AI description
  const handleFetchAIDescription = useCallback(async () => {
    if (!song || !openRouterKey) return

    setIsLoadingAI(true)
    try {
      const prompt = `Provide a brief, insightful description of the song "${song.title}" by ${song.artist}.
Include:
- A 1-2 sentence summary of the song's mood, style, and themes
- Notable aspects (production, vocals, instrumentation)
- Why it might be a good/interesting pick for a music competition

Keep it concise (3-4 sentences max). Be direct and opinionated.`

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: 'You are a music expert providing concise song descriptions for a Music League competition. Be direct, insightful, and opinionated.' },
        { role: 'user', content: prompt },
      ]

      const response = await openRouterService.chat(
        messages,
        defaultModel || 'anthropic/claude-sonnet-4',
        { temperature: 0.7, max_tokens: 300 }
      )

      setAiDescription(response)
      setAiExpanded(true)

      // Cache the AI description
      if (themeId) {
        updateSongInTheme(themeId, song.id, { aiDescription: response })
      }
    } catch (err) {
      console.error('Failed to fetch AI description:', err)
    } finally {
      setIsLoadingAI(false)
    }
  }, [song, themeId, openRouterKey, defaultModel, updateSongInTheme])

  // Handle notes from YouTube popout
  const handleYoutubeNotesSubmit = useCallback((sessionNotes: string) => {
    if (!song || !themeId || !sessionNotes.trim()) return

    const separator = notes.trim() ? '\n\n---\n**YouTube Session Notes:**\n' : '**YouTube Session Notes:**\n'
    const newNotes = notes + separator + sessionNotes
    setNotes(newNotes)
    updateSongInTheme(themeId, song.id, { userNotes: newNotes })
  }, [song, themeId, notes, updateSongInTheme])

  // Retrigger search for Spotify/YouTube
  const handleRetriggerSearch = useCallback(async () => {
    if (!song || !themeId || !editTitle.trim() || !editArtist.trim()) return

    setIsRetriggering(true)
    try {
      // Create a temporary song object with the edited values
      const tempSong = {
        ...song,
        title: editTitle.trim(),
        artist: editArtist.trim(),
      }

      // Search for the song
      const links = await spotifyService.getEnrichedLinks(tempSong)

      if (links.spotifyTrackId || links.youtubeVideoId) {
        // Update the song in the store with the new IDs
        updateSongInTheme(themeId, song.id, {
          spotifyTrackId: links.spotifyTrackId,
          spotifyUri: links.spotifyUri,
          youtubeVideoId: links.youtubeVideoId,
          youtubeUrl: links.youtubeUrl,
          // Also update the title/artist if changed
          title: editTitle.trim(),
          artist: editArtist.trim(),
        })

        // Update local enriched state
        if (links.spotifyTrackId) {
          setEnrichedSpotifyId(links.spotifyTrackId)
        }
        if (links.youtubeVideoId) {
          setEnrichedYoutubeId(links.youtubeVideoId)
        }

        setIsEditingSearch(false)
      } else {
        console.warn('[Retrigger] No matches found for:', editTitle, editArtist)
      }
    } catch (error) {
      console.error('[Retrigger] Failed to search:', error)
    } finally {
      setIsRetriggering(false)
    }
  }, [song, themeId, editTitle, editArtist, updateSongInTheme])

  // Cancel editing and reset to original values
  const handleCancelEdit = useCallback(() => {
    if (song) {
      setEditTitle(song.title)
      setEditArtist(song.artist)
    }
    setIsEditingSearch(false)
  }, [song])

  // Search query for YouTube/Spotify
  const searchQuery = useMemo(() => {
    if (!song) return ''
    return `${song.title} ${song.artist}`
  }, [song])

  // Effective IDs (from song or enriched)
  const effectiveSpotifyId = song?.spotifyTrackId || enrichedSpotifyId
  const effectiveYoutubeId = song?.youtubeVideoId || enrichedYoutubeId

  if (!song) return <></>

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Music className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{song.title}</p>
              <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Song Metadata */}
            <div className="flex flex-wrap gap-2">
              {song.year && (
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  {song.year}
                </Badge>
              )}
              {song.genre && (
                <Badge variant="outline" className="gap-1">
                  <Disc className="h-3 w-3" />
                  {song.genre}
                </Badge>
              )}
              {song.album && (
                <Badge variant="outline" className="gap-1 max-w-[150px]">
                  <span className="truncate">{song.album}</span>
                </Badge>
              )}
              {song.currentTier && (
                <Badge variant="secondary">{song.currentTier}</Badge>
              )}
            </div>

            {/* AI Reason */}
            {song.reason && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Why it fits</span>
                <p className="text-sm">{song.reason}</p>
              </div>
            )}

            {/* Ratings */}
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <span className="text-xs font-medium">Your Ratings</span>
              <div className="grid grid-cols-2 gap-4">
                <StarRating
                  value={themeRating}
                  onChange={handleThemeRatingChange}
                  label="Theme Fit"
                />
                <StarRating
                  value={generalRating}
                  onChange={handleGeneralRatingChange}
                  label="General"
                />
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Your Notes</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setNotesEditable(!notesEditable)}
                >
                  {notesEditable ? 'Preview' : 'Edit'}
                </Button>
              </div>
              {notesEditable ? (
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleSaveNotes}
                  placeholder="Add notes about this song... (Markdown supported)"
                  className="min-h-[100px] text-sm"
                />
              ) : (
                <div className="min-h-[100px] p-3 rounded border bg-muted/30 prose prose-sm dark:prose-invert max-w-none">
                  {notes ? (
                    <ReactMarkdown>{notes}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic">No notes yet</p>
                  )}
                </div>
              )}
            </div>

            {/* AI Description */}
            <Collapsible open={aiExpanded} onOpenChange={setAiExpanded}>
              <div className="rounded-lg border">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">AI Song Description</span>
                    </div>
                    {aiExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-2">
                    {aiDescription ? (
                      <p className="text-sm text-muted-foreground">{aiDescription}</p>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={handleFetchAIDescription}
                        disabled={isLoadingAI || !openRouterKey}
                      >
                        {isLoadingAI ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Get AI Description
                          </>
                        )}
                      </Button>
                    )}
                    {aiDescription && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={handleFetchAIDescription}
                        disabled={isLoadingAI}
                      >
                        Regenerate
                      </Button>
                    )}
                    {!openRouterKey && (
                      <p className="text-xs text-muted-foreground">
                        Configure OpenRouter API key in Settings to use AI features.
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Listen Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Listen</span>
                <div className="flex items-center gap-2">
                  {isEnriching && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Finding links...
                    </span>
                  )}
                  {!isEditingSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => {
                        setEditTitle(song.title)
                        setEditArtist(song.artist)
                        setIsEditingSearch(true)
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit & Search
                    </Button>
                  )}
                </div>
              </div>

              {/* Edit & Retrigger Search Panel */}
              {isEditingSearch && (
                <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Song Title</label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Song title..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Artist</label>
                    <Input
                      value={editArtist}
                      onChange={(e) => setEditArtist(e.target.value)}
                      placeholder="Artist name..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={handleRetriggerSearch}
                      disabled={isRetriggering || !editTitle.trim() || !editArtist.trim()}
                    >
                      {isRetriggering ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3" />
                          Search Again
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={handleCancelEdit}
                      disabled={isRetriggering}
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Edit the title/artist and click "Search Again" to find matching tracks on Spotify & YouTube.
                  </p>
                </div>
              )}

              {/* Spotify Player */}
              <SpotifyEmbed
                trackId={effectiveSpotifyId}
                searchQuery={searchQuery}
              />

              {/* YouTube Player */}
              <YouTubeButton
                videoId={effectiveYoutubeId}
                searchQuery={searchQuery}
                onOpenPopout={() => setYoutubePopoutOpen(true)}
              />
            </div>
          </div>
        </ScrollArea>

        {/* YouTube Popout Modal */}
        {effectiveYoutubeId && (
          <YouTubePopoutModal
            videoId={effectiveYoutubeId}
            songTitle={song.title}
            songArtist={song.artist}
            open={youtubePopoutOpen}
            onOpenChange={setYoutubePopoutOpen}
            onNotesSubmit={handleYoutubeNotesSubmit}
            existingNotes={notes}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
