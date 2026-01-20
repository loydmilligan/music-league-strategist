import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Send,
  Loader2,
  ChevronUp,
  Info,
  Star,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  useMusicLeagueStore,
  getConversationPrompt,
  getConversationPromptWithTheme,
  getFinalistsPrompt,
} from '@/stores/musicLeagueStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { openRouterService } from '@/services/openrouter'
import { spotifyService } from '@/services/spotify'
import type {
  AIConversationResponse,
  Song,
  RejectedSong,
  SessionPreference,
  TierAction,
  MusicLeagueSession
} from '@/types/musicLeague'
import { cn } from '@/lib/utils'

// Parse AI JSON response
function parseAIResponse(content: string): AIConversationResponse | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    return null
  }
}

interface ChatViewProps {
  onSongSelect?: (song: Song) => void
  onSwitchToFunnel?: () => void
}

export function ChatView({
  onSongSelect,
  onSwitchToFunnel
}: ChatViewProps): React.ReactElement {
  const [input, setInput] = useState('')
  const [showWorkingSet, setShowWorkingSet] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sendingRef = useRef(false) // Prevent double-sends

  // Store state
  const {
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
    addToConversation,
    incrementIteration,
    setProcessing,
    setError,
    addRejectedSongs,
    addSessionPreferences,
    promoteSong,
    addCandidateToTheme,
    updateTheme,
    addToSongsILike,
  } = useMusicLeagueStore()

  const openRouterKey = useSettingsStore((s) => s.openRouterKey)
  const defaultModel = useSettingsStore((s) => s.defaultModel)

  const theme = activeTheme()
  const session = activeSession()
  const candidates = session?.workingCandidates || session?.candidates || []
  const conversation = session?.conversationHistory || []

  const getModelId = useCallback((): string => {
    if (strategistModel) return strategistModel
    if (defaultModel) return defaultModel
    return 'anthropic/claude-sonnet-4'
  }, [strategistModel, defaultModel])

  // Auto-scroll to bottom
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
        resumeSession(themeSessions[0].id)
      }
    }
  }, [activeThemeId, activeSessionId, sessions, createSession, resumeSession])

  // Handle tier actions from AI
  const handleTierActions = useCallback(async (actions: TierAction[]): Promise<void> => {
    if (!theme) return

    for (const action of actions) {
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

      if ('songTitle' in action && 'songArtist' in action) {
        const song = candidates.find(
          (s) =>
            s.title.toLowerCase() === action.songTitle.toLowerCase() &&
            s.artist.toLowerCase() === action.songArtist.toLowerCase()
        )

        if (!song) continue

        if (action.action === 'promote' && 'toTier' in action) {
          addCandidateToTheme(theme.id, song)
          if (action.toTier !== 'candidates') {
            promoteSong(theme.id, { ...song, currentTier: 'candidates' }, action.toTier, action.reason)
          }
        }
      }
    }
  }, [theme, candidates, addCandidateToTheme, promoteSong])

  // Main send handler
  const handleSend = useCallback(async () => {
    // Immediate guard using ref to prevent double-sends
    if (!input.trim() || isProcessing || sendingRef.current) return
    sendingRef.current = true

    const userMessage = input.trim()
    setInput('')
    setError(null)

    if (!openRouterKey) {
      setError('OpenRouter API key not configured. Add it in Settings.')
      sendingRef.current = false
      return
    }

    let currentTheme = theme
    let currentThemeId = activeThemeId
    if (!currentTheme) {
      currentThemeId = createTheme(userMessage)
      currentTheme = {
        id: currentThemeId,
        rawTheme: userMessage,
        title: userMessage.slice(0, 50),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pick: null,
        finalists: [],
        semifinalists: [],
        candidates: [],
        status: 'active' as const,
      }
      setTheme({ rawTheme: userMessage })
    }

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

    if (!currentSession) {
      setError('Could not create session. Please try again.')
      sendingRef.current = false
      return
    }

    addToConversation('user', userMessage)
    setProcessing(true)

    try {
      const aggregatedRejected = currentTheme ? getAggregatedRejectedSongs(currentTheme.id) : []
      const aggregatedPrefs = currentTheme ? getAggregatedPreferences(currentTheme.id) : []

      const systemPrompt = currentSession.phase === 'finalists' || currentSession.phase === 'decide'
        ? getFinalistsPrompt(currentSession)
        : currentTheme
          ? getConversationPromptWithTheme(currentSession, currentTheme, aggregatedRejected, aggregatedPrefs, userProfile)
          : getConversationPrompt(currentSession, userProfile)

      const currentConversation = currentSession.conversationHistory || []
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...currentConversation.map((entry) => ({
          role: entry.role as 'user' | 'assistant',
          content: entry.content,
        })),
        { role: 'user', content: userMessage },
      ]

      const assistantContent = await openRouterService.chat(
        messages,
        getModelId(),
        { temperature: 0.8, max_tokens: 4000 }
      )

      const parsed = parseAIResponse(assistantContent)

      if (parsed) {
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

          try {
            newCandidates = await spotifyService.enrichSongsWithTrackIds(newCandidates)
          } catch (enrichError) {
            console.warn('Failed to enrich songs:', enrichError)
          }

          setWorkingCandidates(newCandidates)
          setShowWorkingSet(true)
        }

        if (parsed.interpretation && currentTheme) {
          updateTheme(currentTheme.id, { interpretation: parsed.interpretation })
        }

        if (parsed.extractedPreferences && parsed.extractedPreferences.length > 0) {
          const sessionPrefs: SessionPreference[] = parsed.extractedPreferences.map((p) => ({
            statement: p.statement,
            confidence: p.confidence,
            source: userMessage,
            timestamp: Date.now(),
          }))
          addSessionPreferences(sessionPrefs)
        }

        if (parsed.songsToReject && parsed.songsToReject.length > 0) {
          const rejectedSongs: RejectedSong[] = parsed.songsToReject.map((s) => ({
            title: s.title,
            artist: s.artist,
            reason: s.reason,
            timestamp: Date.now(),
          }))
          addRejectedSongs(rejectedSongs)
        }

        if (parsed.tierActions && parsed.tierActions.length > 0) {
          await handleTierActions(parsed.tierActions)
        }

        if (parsed.action === 'save_to_liked' && parsed.songToSave) {
          const songToSave = parsed.songToSave
          const newSong: Song = {
            id: `saved-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            title: songToSave.title,
            artist: songToSave.artist,
            album: songToSave.album,
            year: songToSave.year,
            genre: songToSave.genre,
            reason: songToSave.reason || 'Saved from conversation',
          }
          addToSongsILike(newSong, [], songToSave.reason, currentTheme?.id)
        }

        addToConversation('assistant', parsed.message)
      } else {
        addToConversation('assistant', assistantContent)
      }

      incrementIteration()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get response'
      setError(message)
      addToConversation('system', `Error: ${message}`)
    } finally {
      setProcessing(false)
      sendingRef.current = false
    }
  }, [
    input, isProcessing, session, theme, openRouterKey, userProfile, candidates,
    addToConversation, setTheme, setWorkingCandidates, incrementIteration,
    setProcessing, setError, getModelId, addRejectedSongs, addSessionPreferences,
    createTheme, createSession, activeThemeId,
    sessions, getAggregatedRejectedSongs, getAggregatedPreferences, handleTierActions,
    updateTheme, addCandidateToTheme, promoteSong, addToSongsILike
  ])

  // Promote to theme funnel
  const handlePromoteToTheme = useCallback((song: Song) => {
    if (!theme) return
    addCandidateToTheme(theme.id, song)
  }, [theme, addCandidateToTheme])

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4">
          {conversation.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl mb-2">Start Discovering</h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Paste your Music League theme below. I'll suggest songs and help you find a winner.
              </p>
            </div>
          ) : (
            conversation.map((entry, index) => (
              <div
                key={`${entry.timestamp}-${index}`}
                className={cn(
                  'chat-bubble animate-fade-in',
                  entry.role === 'user' && 'chat-bubble-user',
                  entry.role === 'assistant' && 'chat-bubble-assistant',
                  entry.role === 'system' && 'chat-bubble-assistant bg-warning/10 border border-warning/20'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
              </div>
            ))
          )}
          {isProcessing && (
            <div className="chat-bubble chat-bubble-assistant">
              <div className="loading-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Working Set Panel */}
      {candidates.length > 0 && (
        <Sheet open={showWorkingSet} onOpenChange={setShowWorkingSet}>
          <SheetTrigger asChild>
            <button className={cn(
              'flex items-center justify-between w-full px-4 py-3',
              'border-t bg-card/50 backdrop-blur-sm',
              'transition-all duration-200'
            )}>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  {candidates.slice(0, 3).map((_, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full bg-primary/20 border-2 border-background"
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">
                  {candidates.length} song{candidates.length !== 1 ? 's' : ''} discovered
                </span>
              </div>
              <ChevronUp className={cn(
                'h-5 w-5 text-muted-foreground transition-transform',
                showWorkingSet && 'rotate-180'
              )} />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl">
            <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted" />
            <div className="py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg">Working Set</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowWorkingSet(false)
                    onSwitchToFunnel?.()
                  }}
                >
                  View Funnel
                </Button>
              </div>
              <ScrollArea className="h-[calc(60vh-120px)]">
                <div className="space-y-2 pr-4">
                  {candidates.map((song) => (
                    <div
                      key={song.id}
                      className={cn(
                        'song-card',
                        song.isFavorite && 'border-primary/50'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onSongSelect?.(song)}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => toggleFavorite(song.id)}
                        >
                          <Star className={cn(
                            'h-4 w-4',
                            song.isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground'
                          )} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-success"
                          onClick={() => handlePromoteToTheme(song)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t bg-background/80 backdrop-blur-sm px-4 py-3 pb-safe">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={!theme ? 'Paste your theme...' : 'Chat to refine...'}
            className="min-h-[48px] max-h-[120px] resize-none text-base selectable"
            disabled={isProcessing}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            size="icon"
            className="h-12 w-12 rounded-xl flex-shrink-0"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
