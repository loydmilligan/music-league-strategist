import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Music2,
  Send,
  Star,
  ExternalLink,
  Loader2,
  ChevronUp,
  Copy,
  Check,
  PanelRightOpen,
  PanelRightClose,
  Clock,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useMusicLeagueStore,
  getConversationPrompt,
  getConversationPromptWithTheme,
  getFinalistsPrompt,
  getLongTermPreferencePrompt,
} from '@/stores/musicLeagueStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useModelsStore } from '@/stores/modelsStore'
import type { AIModel } from '@/types/models'
import { openRouterService } from '@/services/openrouter'
import { youtubeMusicService } from '@/services/youtubeMusic'
import { spotifyService } from '@/services/spotify'
import type { AIConversationResponse, Song, RejectedSong, SessionPreference, LongTermPreference, TierAction, MusicLeagueSession } from '@/types/musicLeague'
import { cn } from '@/lib/utils'
import { ThemeSelector } from './ThemeSelector'
import { SessionManager } from './SessionManager'
import { FunnelVisualization, FunnelSummary } from './FunnelVisualization'
import { PlaylistSyncPanel } from './PlaylistSyncPanel'
import { SongDetailSlideout } from './SongDetailSlideout'

// Parse AI JSON response
function parseAIResponse(content: string): AIConversationResponse | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    return null
  }
}

// Get YouTube search URL for a song
function getYouTubeUrl(song: Song): string {
  if (song.youtubeVideoId) {
    return `https://www.youtube.com/watch?v=${song.youtubeVideoId}`
  }
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`
}

export function MusicLeagueStrategist(): React.ReactElement {
  const [input, setInput] = useState('')
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [showFunnel, setShowFunnel] = useState(true)
  const [copiedExport, setCopiedExport] = useState(false)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [slideoutOpen, setSlideoutOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Store state
  const {
    themes,
    activeThemeId,
    sessions,
    activeSessionId,
    strategistModel,
    isProcessing,
    error,
    userProfile,
    activeTheme,
    activeSession,
    getAggregatedRejectedSongs,
    getAggregatedPreferences,
    createTheme,
    createSession,
    resumeSession,
    setTheme,
    setWorkingCandidates,
    toggleFavorite,
    setFinalists,
    addToConversation,
    setPlaylistCreated,
    incrementIteration,
    setProcessing,
    setError,
    setStrategistModel,
    addRejectedSongs,
    addSessionPreferences,
    addLongTermPreferences,
    setFinalPick,
    promoteSong,
    addCandidateToTheme,
    exportFunnelSummary,
    updateTheme,
  } = useMusicLeagueStore()

  // Settings
  const openRouterKey = useSettingsStore((s) => s.openRouterKey)
  const defaultModel = useSettingsStore((s) => s.defaultModel)

  // Derived state
  const theme = activeTheme()
  const session = activeSession()
  const candidates = session?.workingCandidates || session?.candidates || []
  const finalists = session?.finalists || []
  const conversation = session?.conversationHistory || []

  // Get the model to use
  const getModelId = useCallback((): string => {
    if (strategistModel) return strategistModel
    if (defaultModel) return defaultModel
    return 'anthropic/claude-sonnet-4'
  }, [strategistModel, defaultModel])

  // Get models from store
  const models = useModelsStore((s) => s.models)
  const getModelNickname = useModelsStore((s) => s.getNickname)

  // Get model nickname
  const getNickname = (modelId: string): string => {
    return getModelNickname(modelId)
  }

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.length])

  // Create session when theme is selected but no session exists
  useEffect(() => {
    if (activeThemeId && !activeSessionId) {
      const themeSessions = sessions.filter((s) => s.themeId === activeThemeId)
      if (themeSessions.length === 0) {
        createSession(activeThemeId)
      } else {
        // Resume the most recent session
        resumeSession(themeSessions[0].id)
      }
    }
  }, [activeThemeId, activeSessionId, sessions, createSession, resumeSession])

  // Handle tier actions from AI (Feature 1: add_to_candidates support)
  const handleTierActions = useCallback(async (actions: TierAction[]): Promise<void> => {
    if (!theme) return

    for (const action of actions) {
      // Handle add_to_candidates action (Feature 1)
      if (action.action === 'add_to_candidates' && 'song' in action) {
        const songData = action.song
        let newSong: Song = {
          id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          title: songData.title,
          artist: songData.artist,
          album: songData.album,
          year: songData.year,
          genre: songData.genre,
          reason: songData.reason || action.reason || 'Added via command',
        }

        // Try to enrich with Spotify/YouTube links
        try {
          const enriched = await spotifyService.enrichSongsWithTrackIds([newSong])
          if (enriched.length > 0) {
            newSong = enriched[0]
          }
        } catch (err) {
          console.warn('Failed to enrich song:', err)
        }

        addCandidateToTheme(theme.id, newSong)
        continue
      }

      // Handle promote/demote/remove actions
      if ('songTitle' in action && 'songArtist' in action) {
        // Find the song in working candidates
        const song = candidates.find(
          (s) =>
            s.title.toLowerCase() === action.songTitle.toLowerCase() &&
            s.artist.toLowerCase() === action.songArtist.toLowerCase()
        )

        if (!song) continue

        if (action.action === 'promote' && 'toTier' in action) {
          // First add to theme candidates if not already there
          addCandidateToTheme(theme.id, song)
          // Then promote if needed
          if (action.toTier !== 'candidates') {
            promoteSong(theme.id, { ...song, currentTier: 'candidates' }, action.toTier, action.reason)
          }
        }
      }
    }
  }, [theme, candidates, addCandidateToTheme, promoteSong])

  // Main send handler
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return

    const userMessage = input.trim()
    setInput('')
    setError(null)

    // Check API key
    if (!openRouterKey) {
      setError('OpenRouter API key not configured. Add it in Settings.')
      return
    }

    // If no theme exists, create one from the first message
    let currentTheme = theme
    let currentThemeId = activeThemeId
    if (!currentTheme) {
      currentThemeId = createTheme(userMessage)
      currentTheme = themes.find((t) => t.id === currentThemeId)

      // Also update the session's legacy theme field
      setTheme({ rawTheme: userMessage })
    }

    // If no session exists, create one for the theme
    let currentSession = session
    if (!currentSession && currentThemeId) {
      const sessionId = createSession(currentThemeId)
      currentSession = sessions.find((s) => s.id === sessionId) || {
        id: sessionId,
        themeId: currentThemeId,
        title: userMessage.slice(0, 50),
        phase: 'brainstorm',
        iterationCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as MusicLeagueSession
    }

    // Still no session? Return early
    if (!currentSession) {
      setError('Could not create session. Please try again.')
      return
    }

    // Add user message to conversation
    addToConversation('user', userMessage)

    setProcessing(true)

    try {
      // Build system prompt with theme context
      const aggregatedRejected = currentTheme ? getAggregatedRejectedSongs(currentTheme.id) : []
      const aggregatedPrefs = currentTheme ? getAggregatedPreferences(currentTheme.id) : []

      const systemPrompt = currentSession.phase === 'finalists' || currentSession.phase === 'decide'
        ? getFinalistsPrompt(currentSession)
        : currentTheme
          ? getConversationPromptWithTheme(currentSession, currentTheme, aggregatedRejected, aggregatedPrefs, userProfile)
          : getConversationPrompt(currentSession, userProfile)

      // Build messages
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...conversation.map((entry) => ({
          role: entry.role as 'user' | 'assistant',
          content: entry.content,
        })),
        { role: 'user', content: userMessage },
      ]

      // Call OpenRouter (non-streaming for JSON parsing)
      const assistantContent = await openRouterService.chat(
        messages,
        getModelId(),
        { temperature: 0.8, max_tokens: 4000 }
      )

      // Parse the AI response
      const parsed = parseAIResponse(assistantContent)

      if (parsed) {
        // Update working candidates from response
        if (parsed.candidates && parsed.candidates.length > 0) {
          let newCandidates: Song[] = parsed.candidates.map((c, idx) => ({
            id: `song-${Date.now()}-${idx}`,
            title: c.title,
            artist: c.artist,
            album: c.album,
            year: c.year,
            genre: c.genre,
            reason: c.reason,
            question: c.question,
            addedInSessionId: currentSession.id,
          }))

          // Enrich candidates with Spotify track IDs and YouTube links via Songlink
          try {
            newCandidates = await spotifyService.enrichSongsWithTrackIds(newCandidates)
          } catch (enrichError) {
            console.warn('Failed to enrich songs with platform links:', enrichError)
          }

          setWorkingCandidates(newCandidates)
        }

        // Update theme interpretation
        if (parsed.interpretation && currentTheme) {
          updateTheme(currentTheme.id, { interpretation: parsed.interpretation })
          // Also update session's legacy theme
          if (currentSession.theme) {
            setTheme({ ...currentSession.theme, interpretation: parsed.interpretation })
          }
        }

        // Handle extracted preferences from AI response
        if (parsed.extractedPreferences && parsed.extractedPreferences.length > 0) {
          const sessionPrefs: SessionPreference[] = parsed.extractedPreferences.map((p) => ({
            statement: p.statement,
            confidence: p.confidence,
            source: userMessage,
            timestamp: Date.now(),
          }))
          addSessionPreferences(sessionPrefs)
        }

        // Handle songs to reject from AI response
        if (parsed.songsToReject && parsed.songsToReject.length > 0) {
          const rejectedSongs: RejectedSong[] = parsed.songsToReject.map((s) => ({
            title: s.title,
            artist: s.artist,
            reason: s.reason,
            timestamp: Date.now(),
          }))
          addRejectedSongs(rejectedSongs)
        }

        // Handle tier actions from AI
        if (parsed.tierActions && parsed.tierActions.length > 0) {
          await handleTierActions(parsed.tierActions)
        }

        // Handle actions
        if (parsed.action) {
          if (parsed.action === 'create_playlist:spotify' || parsed.action === 'create_playlist:youtube') {
            const platform = parsed.action.includes('spotify') ? 'spotify' : 'youtube'
            await handleCreatePlaylist(platform)
          } else if (parsed.action === 'enter_finalists') {
            setFinalists(candidates)
          } else if (parsed.action === 'finalize_pick') {
            // Handle final pick
            let finalSong: Song | undefined
            const pickedCandidate = parsed.candidates?.[0]
            if (pickedCandidate) {
              finalSong = candidates.find(
                (c) => c.title.toLowerCase() === pickedCandidate.title.toLowerCase() &&
                       c.artist.toLowerCase() === pickedCandidate.artist.toLowerCase()
              )
            }
            if (!finalSong && finalists.length > 0) {
              finalSong = finalists[0]
            }
            if (!finalSong && candidates.length > 0) {
              finalSong = candidates[0]
            }
            if (finalSong) {
              setFinalPick(finalSong)
              // Also promote to pick in theme funnel
              if (currentTheme) {
                addCandidateToTheme(currentTheme.id, finalSong)
                promoteSong(currentTheme.id, { ...finalSong, currentTier: 'candidates' }, 'pick', 'Final pick selected')
              }
            }

            // Extract long-term preferences from session
            if (currentSession.sessionPreferences && currentSession.sessionPreferences.length > 0) {
              try {
                const extractionPrompt = getLongTermPreferencePrompt(
                  currentSession.sessionPreferences,
                  userProfile?.longTermPreferences || []
                )
                const extractionMessages: Array<{ role: 'system' | 'user'; content: string }> = [
                  { role: 'system', content: extractionPrompt },
                  { role: 'user', content: 'Extract long-term preferences from this session now.' },
                ]
                const extractionResult = await openRouterService.chat(
                  extractionMessages,
                  getModelId(),
                  { temperature: 0.3, max_tokens: 2000 }
                )
                try {
                  const jsonMatch = extractionResult.match(/\{[\s\S]*\}/)
                  if (jsonMatch) {
                    const extractedPrefs = JSON.parse(jsonMatch[0]) as {
                      newLongTermPreferences?: Array<{
                        statement: string
                        specificity: 'general' | 'specific'
                        weight: number
                      }>
                    }
                    if (extractedPrefs.newLongTermPreferences && extractedPrefs.newLongTermPreferences.length > 0) {
                      const newPrefs: LongTermPreference[] = extractedPrefs.newLongTermPreferences.map((p) => ({
                        statement: p.statement,
                        specificity: p.specificity,
                        weight: p.weight,
                        addedAt: Date.now(),
                      }))
                      addLongTermPreferences(newPrefs)
                      addToConversation('system', `Learned ${newPrefs.length} new long-term preference(s) from this session.`)
                    }
                  }
                } catch (parseError) {
                  console.error('Failed to parse long-term preference extraction:', parseError)
                }
              } catch (err) {
                console.error('Failed to extract long-term preferences:', err)
              }
            }
          }
        }

        // Add the conversational message to history
        addToConversation('assistant', parsed.message)
      } else {
        // If we can't parse, just add the raw response
        addToConversation('assistant', assistantContent)
      }

      incrementIteration()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get response'
      setError(message)
      addToConversation('system', `Error: ${message}`)
    } finally {
      setProcessing(false)
    }
  }, [
    input,
    isProcessing,
    session,
    theme,
    themes,
    conversation,
    openRouterKey,
    userProfile,
    candidates,
    finalists,
    addToConversation,
    setTheme,
    setWorkingCandidates,
    setFinalists,
    incrementIteration,
    setProcessing,
    setError,
    getModelId,
    addRejectedSongs,
    addSessionPreferences,
    addLongTermPreferences,
    setFinalPick,
    createTheme,
    createSession,
    activeThemeId,
    sessions,
    getAggregatedRejectedSongs,
    getAggregatedPreferences,
    handleTierActions,
    updateTheme,
    addCandidateToTheme,
    promoteSong,
  ])

  // Create playlist handler
  const handleCreatePlaylist = useCallback(async (platform: 'youtube' | 'spotify') => {
    if (candidates.length === 0) return

    setIsCreatingPlaylist(true)

    try {
      const service = platform === 'spotify' ? spotifyService : youtubeMusicService
      const configCheck = service.checkConfiguration()

      if (!configCheck.configured) {
        // Fallback to opening search tabs
        candidates.forEach((song, index) => {
          const query = encodeURIComponent(`${song.title} ${song.artist}`)
          const baseUrl = platform === 'spotify'
            ? 'https://open.spotify.com/search/'
            : 'https://music.youtube.com/search?q='
          setTimeout(() => {
            window.open(`${baseUrl}${query}`, '_blank', 'noopener')
          }, index * 250)
        })
        addToConversation('system', `${platform === 'spotify' ? 'Spotify' : 'YouTube Music'} not configured. Opened search tabs instead.`)
        return
      }

      // Create actual playlist
      const themeName = theme?.title || session?.theme?.rawTheme || 'Music League'
      const title = `ML: ${themeName.split('\n')[0].substring(0, 50)}`
      const description = `Music League candidates. Generated by Music League Strategist.`

      const result = await service.createPlaylist(title, description, candidates)

      setPlaylistCreated(platform, result.playlistId, result.playlistUrl)
      addToConversation('assistant', `Playlist created on ${platform === 'spotify' ? 'Spotify' : 'YouTube Music'}!\n\n[Open Playlist](${result.playlistUrl})\n\nGive it a listen, then come back and tell me what you think. Any songs that hit different? Any that fell flat?`)

      // Open the playlist
      window.open(result.playlistUrl, '_blank', 'noopener')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create playlist'
      setError(message)
      addToConversation('system', `Error creating playlist: ${message}`)
    } finally {
      setIsCreatingPlaylist(false)
    }
  }, [candidates, theme, session, addToConversation, setPlaylistCreated, setError])

  // Promote song from working set to theme candidates
  const handlePromoteToTheme = useCallback((song: Song) => {
    if (!theme) return
    addCandidateToTheme(theme.id, song)
  }, [theme, addCandidateToTheme])

  // Export funnel summary
  const handleExport = useCallback(() => {
    if (!theme) return
    const summary = exportFunnelSummary(theme.id)
    navigator.clipboard.writeText(summary)
    setCopiedExport(true)
    setTimeout(() => setCopiedExport(false), 2000)
  }, [theme, exportFunnelSummary])

  // Handle song click to open slideout
  const handleSongClick = useCallback((song: Song) => {
    setSelectedSong(song)
    setSlideoutOpen(true)
  }, [])

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Model options from models store
  const modelValue = strategistModel ?? defaultModel ?? '__default__'
  const defaultModelLabel = defaultModel ? `Default (${getNickname(defaultModel)})` : 'Default'

  // Deadline display
  const deadlineDisplay = theme?.deadline ? (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>
        {Math.ceil((theme.deadline - Date.now()) / (1000 * 60 * 60 * 24))}d left
      </span>
    </div>
  ) : null

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background" data-testid="music-league-strategist">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Music2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold" data-testid="ml-header">Music League</h2>
            <div className="flex items-center gap-2">
              {theme && <FunnelSummary theme={theme} />}
              {deadlineDisplay}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeSelector />
          <SessionManager />

          {/* Model selector */}
          <Select
            value={modelValue}
            onValueChange={(value) =>
              setStrategistModel(value === '__default__' ? null : value)
            }
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">{defaultModelLabel}</SelectItem>
              {models.map((model: AIModel) => (
                <SelectItem key={model.id} value={model.model_id}>
                  {model.nickname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowFunnel(!showFunnel)}
            title={showFunnel ? 'Hide funnel' : 'Show funnel'}
          >
            {showFunnel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel */}
        <div className="flex flex-1 flex-col overflow-hidden border-r">
          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-3">
              {conversation.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-testid="ml-welcome-message">
                  <p className="font-medium">Drop your Music League theme to get started.</p>
                  <p className="mt-2 text-xs">
                    I'll generate 5-8 candidates and ask questions to refine the list.
                    Promote songs to your funnel as you find winners.
                  </p>
                </div>
              ) : (
                conversation.map((entry, index) => (
                  <div
                    key={`${entry.timestamp}-${index}`}
                    data-testid={`ml-message-${entry.role}-${index}`}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm',
                      entry.role === 'assistant' && 'bg-muted/30',
                      entry.role === 'user' && 'bg-primary/5 border-primary/20',
                      entry.role === 'system' && 'bg-yellow-500/10 border-yellow-500/20'
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <span>{entry.role === 'assistant' ? 'Strategist' : entry.role}</span>
                      <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Working candidates */}
          {candidates.length > 0 && (
            <div className="border-t px-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Working Set ({candidates.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {candidates.map((song) => (
                  <div
                    key={song.id}
                    className={cn(
                      'flex items-center gap-1 rounded border px-2 py-1 text-xs',
                      song.isFavorite && 'border-amber-500/50 bg-amber-500/5'
                    )}
                  >
                    <span className="truncate max-w-[100px]">{song.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() => handleSongClick(song)}
                      title="Song details"
                    >
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() => toggleFavorite(song.id)}
                    >
                      <Star
                        className={cn(
                          'h-3 w-3',
                          song.isFavorite ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'
                        )}
                      />
                    </Button>
                    {theme && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => handlePromoteToTheme(song)}
                        title="Add to theme candidates"
                      >
                        <ChevronUp className="h-3 w-3 text-green-500" />
                      </Button>
                    )}
                    <a
                      href={getYouTubeUrl(song)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-4 w-4 items-center justify-center"
                    >
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="border-t border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Input area */}
          <div className="border-t px-4 py-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !theme
                  ? 'Paste your Music League theme here...'
                  : 'Chat to refine candidates, or say "make this a Spotify playlist"...'
              }
              className="min-h-[60px] resize-none text-sm"
              disabled={isProcessing}
              data-testid="ml-input"
            />
            <div className="mt-2 flex items-center justify-between">
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                size="sm"
                className="gap-2"
                data-testid="ml-send-button"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" data-testid="ml-loading" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
              <div className="flex gap-2">
                {candidates.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreatePlaylist('spotify')}
                      disabled={isCreatingPlaylist}
                      className="text-xs"
                    >
                      {isCreatingPlaylist ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                      Spotify
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreatePlaylist('youtube')}
                      disabled={isCreatingPlaylist}
                      className="text-xs"
                    >
                      YouTube
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Funnel Panel */}
        {showFunnel && theme && (
          <div className="w-[280px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">Funnel</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleExport}
                  title="Copy funnel summary"
                >
                  {copiedExport ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-3">
              <FunnelVisualization theme={theme} compact onSongClick={handleSongClick} />
            </ScrollArea>
            <div className="border-t p-3">
              <PlaylistSyncPanel theme={theme} />
            </div>
          </div>
        )}
      </div>

      {/* Song Detail Slideout */}
      <SongDetailSlideout
        song={selectedSong}
        themeId={theme?.id || null}
        open={slideoutOpen}
        onOpenChange={setSlideoutOpen}
      />
    </div>
  )
}
