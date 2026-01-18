// Music League Strategist Store - Multi-Tier Funnel Design

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  MusicLeaguePhase,
  MusicLeagueSession,
  MusicLeagueTheme,
  MusicLeagueUserProfile,
  PreferenceEvidence,
  Song,
  ThemeContext,
  RejectedSong,
  SessionPreference,
  LongTermPreference,
  FunnelTier,
  ThemeStatus,
} from '@/types/musicLeague'
import { MUSIC_LEAGUE_PROMPTS, FUNNEL_TIER_LIMITS } from '@/types/musicLeague'

function generateId(): string {
  return `ml-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function generateThemeId(): string {
  return `theme-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function generateSongId(): string {
  return `song-${Math.random().toString(36).slice(2, 11)}`
}

// Generate a title from the raw theme text
function generateThemeTitle(rawTheme: string): string {
  // Take first line, trim, and limit to 50 chars
  const firstLine = rawTheme.split('\n')[0].trim()
  return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine
}

interface MusicLeagueState {
  // === State ===
  // Themes (NEW)
  themes: MusicLeagueTheme[]
  activeThemeId: string | null

  // Sessions
  sessions: MusicLeagueSession[]
  activeSessionId: string | null

  // UI/Processing
  strategistModel: string | null
  isProcessing: boolean
  error: string | null

  // User profile
  userProfile: MusicLeagueUserProfile | null

  // Migration version
  _version: number

  // === Getters ===
  activeTheme: () => MusicLeagueTheme | undefined
  activeSession: () => MusicLeagueSession | undefined
  getThemeSessions: (themeId: string) => MusicLeagueSession[]
  getAggregatedRejectedSongs: (themeId: string) => RejectedSong[]
  getAggregatedPreferences: (themeId: string) => SessionPreference[]

  // === Theme Management (NEW) ===
  createTheme: (rawTheme: string) => string
  updateTheme: (themeId: string, updates: Partial<MusicLeagueTheme>) => void
  setActiveTheme: (themeId: string | null) => void
  archiveTheme: (themeId: string) => void
  deleteTheme: (themeId: string) => void
  setThemeDeadline: (themeId: string, deadline: number | undefined) => void

  // === Session Management ===
  createSession: (themeId?: string) => string
  createSessionForTheme: (themeId: string) => string
  updateSessionTitle: (sessionId: string, title: string) => void
  resumeSession: (id: string) => void
  deleteSession: (id: string) => void
  clearAllSessions: () => void

  // === Tier Management (NEW) ===
  promoteSong: (themeId: string, song: Song, toTier: FunnelTier, reason?: string) => void
  demoteSong: (themeId: string, song: Song, toTier: FunnelTier, reason?: string) => void
  removeSongFromTier: (themeId: string, songId: string, tier: FunnelTier) => void
  addCandidateToTheme: (themeId: string, song: Song) => void
  setThemePick: (themeId: string, song: Song | null) => void

  // === Song Metadata (NEW) ===
  updateSongInTheme: (themeId: string, songId: string, updates: Partial<Song>) => void
  reorderSongsInTier: (themeId: string, tier: FunnelTier, songIds: string[]) => void

  // === Playlist Sync (NEW) ===
  setThemePlaylist: (themeId: string, tier: FunnelTier, playlistId: string, playlistUrl: string) => void

  // === Phase Management ===
  setPhase: (phase: MusicLeaguePhase) => void

  // === Legacy Theme Support ===
  setTheme: (theme: ThemeContext) => void

  // === Working Candidates Management ===
  setWorkingCandidates: (songs: Song[]) => void
  setCandidates: (songs: Song[]) => void  // Legacy alias
  updateCandidate: (songId: string, updates: Partial<Song>) => void
  toggleFavorite: (songId: string) => void

  // === Legacy Finalists Management ===
  setFinalists: (songs: Song[]) => void
  addToFinalists: (song: Song) => void
  removeFromFinalists: (songId: string) => void

  // === Conversation History ===
  addToConversation: (role: 'user' | 'assistant' | 'system', content: string) => void
  clearConversation: () => void
  addPreferenceEvidence: (role: PreferenceEvidence['role'], content: string) => void

  // === Playlist Creation (Legacy) ===
  setPlaylistCreated: (platform: 'youtube' | 'spotify', playlistId: string, playlistUrl: string) => void

  // === Iteration tracking ===
  incrementIteration: () => void

  // === Rejected Songs Management ===
  addRejectedSong: (song: RejectedSong) => void
  addRejectedSongs: (songs: RejectedSong[]) => void
  isRejected: (title: string, artist: string) => boolean

  // === Session Preferences Management ===
  addSessionPreference: (pref: SessionPreference) => void
  addSessionPreferences: (prefs: SessionPreference[]) => void
  clearSessionPreferences: () => void

  // === Long-Term Preferences Management ===
  addLongTermPreferences: (prefs: LongTermPreference[]) => void
  removeLongTermPreference: (statement: string) => void

  // === Final Pick ===
  setFinalPick: (song: Song) => void

  // === Utility ===
  setProcessing: (processing: boolean) => void
  setError: (error: string | null) => void
  setUserProfile: (profile: MusicLeagueUserProfile | null) => void
  setStrategistModel: (model: string | null) => void

  // === Export ===
  exportFunnelSummary: (themeId: string) => string
}

export const useMusicLeagueStore = create<MusicLeagueState>()(
  persist(
    (set, get) => ({
      // === Initial State ===
      themes: [],
      activeThemeId: null,
      sessions: [],
      activeSessionId: null,
      strategistModel: null,
      isProcessing: false,
      error: null,
      userProfile: null,
      _version: 2,

      // === Getters ===
      activeTheme: () => {
        const state = get()
        return state.themes.find((t) => t.id === state.activeThemeId)
      },

      activeSession: () => {
        const state = get()
        return state.sessions.find((s) => s.id === state.activeSessionId)
      },

      getThemeSessions: (themeId: string) => {
        const state = get()
        return state.sessions.filter((s) => s.themeId === themeId)
      },

      getAggregatedRejectedSongs: (themeId: string) => {
        const sessions = get().getThemeSessions(themeId)
        const allRejected: RejectedSong[] = []
        const seen = new Set<string>()

        for (const session of sessions) {
          for (const rejected of session.rejectedSongs || []) {
            const key = `${rejected.title.toLowerCase()}:${rejected.artist.toLowerCase()}`
            if (!seen.has(key)) {
              seen.add(key)
              allRejected.push(rejected)
            }
          }
        }
        return allRejected
      },

      getAggregatedPreferences: (themeId: string) => {
        const sessions = get().getThemeSessions(themeId)
        const allPrefs: SessionPreference[] = []

        for (const session of sessions) {
          for (const pref of session.sessionPreferences || []) {
            allPrefs.push(pref)
          }
        }
        // Sort by confidence (high first), then by timestamp (recent first)
        return allPrefs.sort((a, b) => {
          const confOrder = { high: 0, medium: 1, low: 2 }
          if (confOrder[a.confidence] !== confOrder[b.confidence]) {
            return confOrder[a.confidence] - confOrder[b.confidence]
          }
          return b.timestamp - a.timestamp
        })
      },

      // === Theme Management ===
      createTheme: (rawTheme: string) => {
        const id = generateThemeId()
        const theme: MusicLeagueTheme = {
          id,
          rawTheme,
          title: generateThemeTitle(rawTheme),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pick: null,
          finalists: [],
          semifinalists: [],
          candidates: [],
          status: 'active',
        }

        set((state) => ({
          themes: [theme, ...state.themes],
          activeThemeId: id,
          error: null,
        }))

        return id
      },

      updateTheme: (themeId: string, updates: Partial<MusicLeagueTheme>) => {
        set((state) => ({
          themes: state.themes.map((t) =>
            t.id === themeId
              ? { ...t, ...updates, updatedAt: Date.now() }
              : t
          ),
        }))
      },

      setActiveTheme: (themeId: string | null) => {
        set({ activeThemeId: themeId, error: null })
      },

      archiveTheme: (themeId: string) => {
        set((state) => ({
          themes: state.themes.map((t) =>
            t.id === themeId
              ? { ...t, status: 'archived' as ThemeStatus, updatedAt: Date.now() }
              : t
          ),
        }))
      },

      deleteTheme: (themeId: string) => {
        set((state) => {
          const newThemes = state.themes.filter((t) => t.id !== themeId)
          const newSessions = state.sessions.filter((s) => s.themeId !== themeId)
          const newActiveThemeId =
            state.activeThemeId === themeId
              ? newThemes.find((t) => t.status === 'active')?.id || null
              : state.activeThemeId

          return {
            themes: newThemes,
            sessions: newSessions,
            activeThemeId: newActiveThemeId,
            activeSessionId: state.activeSessionId && newSessions.some((s) => s.id === state.activeSessionId)
              ? state.activeSessionId
              : null,
          }
        })
      },

      setThemeDeadline: (themeId: string, deadline: number | undefined) => {
        set((state) => ({
          themes: state.themes.map((t) =>
            t.id === themeId
              ? { ...t, deadline, updatedAt: Date.now() }
              : t
          ),
        }))
      },

      // === Session Management ===
      createSession: (themeId?: string) => {
        const id = generateId()
        const effectiveThemeId = themeId || get().activeThemeId

        const session: MusicLeagueSession = {
          id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          phase: 'brainstorm',
          themeId: effectiveThemeId || undefined,
          title: `Session ${get().sessions.filter((s) => s.themeId === effectiveThemeId).length + 1}`,
          theme: null,
          workingCandidates: [],
          candidates: [],
          finalists: [],
          rejectedSongs: [],
          sessionPreferences: [],
          conversationHistory: [],
          preferenceEvidence: [],
          iterationCount: 0,
        }

        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: id,
          error: null,
        }))

        return id
      },

      createSessionForTheme: (themeId: string) => {
        return get().createSession(themeId)
      },

      updateSessionTitle: (sessionId: string, title: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, title, updatedAt: Date.now() }
              : s
          ),
        }))
      },

      resumeSession: (id) => {
        set({ activeSessionId: id, error: null })
      },

      deleteSession: (id) => {
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id)
          const newActiveId =
            state.activeSessionId === id
              ? newSessions[0]?.id || null
              : state.activeSessionId

          return {
            sessions: newSessions,
            activeSessionId: newActiveId,
          }
        })
      },

      clearAllSessions: () => {
        set({
          sessions: [],
          activeSessionId: null,
          error: null,
        })
      },

      // === Tier Management ===
      promoteSong: (themeId: string, song: Song, toTier: FunnelTier, reason?: string) => {
        set((state) => ({
          themes: state.themes.map((t) => {
            if (t.id !== themeId) return t

            // Find which tier the song is currently in
            let fromTier: FunnelTier | 'working' = 'working'
            if (t.candidates.some((s) => s.id === song.id)) fromTier = 'candidates'
            else if (t.semifinalists.some((s) => s.id === song.id)) fromTier = 'semifinalists'
            else if (t.finalists.some((s) => s.id === song.id)) fromTier = 'finalists'

            // Check tier limits
            const tierLimit = FUNNEL_TIER_LIMITS[toTier]
            const currentTierSongs =
              toTier === 'pick' ? (t.pick ? [t.pick] : []) :
              toTier === 'finalists' ? t.finalists :
              toTier === 'semifinalists' ? t.semifinalists :
              t.candidates

            if (currentTierSongs.length >= tierLimit) {
              console.warn(`Cannot promote to ${toTier}: tier is full (${tierLimit})`)
              return t
            }

            // Create updated song with promotion record
            const promotedSong: Song = {
              ...song,
              currentTier: toTier,
              promotionHistory: [
                ...(song.promotionHistory || []),
                { fromTier, toTier, reason, timestamp: Date.now() },
              ],
            }

            // Remove from old tier
            const newTheme = { ...t, updatedAt: Date.now() }
            if (fromTier === 'candidates') {
              newTheme.candidates = t.candidates.filter((s) => s.id !== song.id)
            } else if (fromTier === 'semifinalists') {
              newTheme.semifinalists = t.semifinalists.filter((s) => s.id !== song.id)
            } else if (fromTier === 'finalists') {
              newTheme.finalists = t.finalists.filter((s) => s.id !== song.id)
            }

            // Add to new tier
            if (toTier === 'pick') {
              newTheme.pick = promotedSong
            } else if (toTier === 'finalists') {
              newTheme.finalists = [...newTheme.finalists, promotedSong]
            } else if (toTier === 'semifinalists') {
              newTheme.semifinalists = [...newTheme.semifinalists, promotedSong]
            } else {
              newTheme.candidates = [...newTheme.candidates, promotedSong]
            }

            return newTheme
          }),
        }))
      },

      demoteSong: (themeId: string, song: Song, toTier: FunnelTier, reason?: string) => {
        set((state) => ({
          themes: state.themes.map((t) => {
            if (t.id !== themeId) return t

            // Find which tier the song is currently in
            let fromTier: FunnelTier | 'working' = 'working'
            if (t.pick?.id === song.id) fromTier = 'pick'
            else if (t.finalists.some((s) => s.id === song.id)) fromTier = 'finalists'
            else if (t.semifinalists.some((s) => s.id === song.id)) fromTier = 'semifinalists'
            else if (t.candidates.some((s) => s.id === song.id)) fromTier = 'candidates'

            // Create updated song with demotion record
            const demotedSong: Song = {
              ...song,
              currentTier: toTier,
              promotionHistory: [
                ...(song.promotionHistory || []),
                { fromTier, toTier, reason, timestamp: Date.now() },
              ],
            }

            // Remove from old tier
            const newTheme = { ...t, updatedAt: Date.now() }
            if (fromTier === 'pick') {
              newTheme.pick = null
            } else if (fromTier === 'finalists') {
              newTheme.finalists = t.finalists.filter((s) => s.id !== song.id)
            } else if (fromTier === 'semifinalists') {
              newTheme.semifinalists = t.semifinalists.filter((s) => s.id !== song.id)
            } else if (fromTier === 'candidates') {
              newTheme.candidates = t.candidates.filter((s) => s.id !== song.id)
            }

            // Add to new tier
            if (toTier === 'finalists') {
              newTheme.finalists = [...newTheme.finalists, demotedSong]
            } else if (toTier === 'semifinalists') {
              newTheme.semifinalists = [...newTheme.semifinalists, demotedSong]
            } else {
              newTheme.candidates = [...newTheme.candidates, demotedSong]
            }

            return newTheme
          }),
        }))
      },

      removeSongFromTier: (themeId: string, songId: string, tier: FunnelTier) => {
        set((state) => ({
          themes: state.themes.map((t) => {
            if (t.id !== themeId) return t

            const newTheme = { ...t, updatedAt: Date.now() }
            if (tier === 'pick' && t.pick?.id === songId) {
              newTheme.pick = null
            } else if (tier === 'finalists') {
              newTheme.finalists = t.finalists.filter((s) => s.id !== songId)
            } else if (tier === 'semifinalists') {
              newTheme.semifinalists = t.semifinalists.filter((s) => s.id !== songId)
            } else if (tier === 'candidates') {
              newTheme.candidates = t.candidates.filter((s) => s.id !== songId)
            }

            return newTheme
          }),
        }))
      },

      addCandidateToTheme: (themeId: string, song: Song) => {
        set((state) => ({
          themes: state.themes.map((t) => {
            if (t.id !== themeId) return t

            // Check limit
            if (t.candidates.length >= FUNNEL_TIER_LIMITS.candidates) {
              console.warn(`Cannot add candidate: tier is full (${FUNNEL_TIER_LIMITS.candidates})`)
              return t
            }

            // Check for duplicates
            if (t.candidates.some((s) =>
              s.title.toLowerCase() === song.title.toLowerCase() &&
              s.artist.toLowerCase() === song.artist.toLowerCase()
            )) {
              console.warn('Song already exists in candidates')
              return t
            }

            const candidateSong: Song = {
              ...song,
              id: song.id || generateSongId(),
              currentTier: 'candidates',
              addedInSessionId: get().activeSessionId || undefined,
            }

            return {
              ...t,
              candidates: [...t.candidates, candidateSong],
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      setThemePick: (themeId: string, song: Song | null) => {
        set((state) => ({
          themes: state.themes.map((t) =>
            t.id === themeId
              ? { ...t, pick: song, updatedAt: Date.now() }
              : t
          ),
        }))
      },

      // === Song Metadata ===
      updateSongInTheme: (themeId: string, songId: string, updates: Partial<Song>) => {
        set((state) => ({
          themes: state.themes.map((t) => {
            if (t.id !== themeId) return t

            const updateSong = (song: Song): Song =>
              song.id === songId ? { ...song, ...updates } : song

            return {
              ...t,
              pick: t.pick?.id === songId ? { ...t.pick, ...updates } : t.pick,
              finalists: t.finalists.map(updateSong),
              semifinalists: t.semifinalists.map(updateSong),
              candidates: t.candidates.map(updateSong),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      reorderSongsInTier: (themeId: string, tier: FunnelTier, songIds: string[]) => {
        set((state) => ({
          themes: state.themes.map((t) => {
            if (t.id !== themeId) return t

            const reorderArray = (songs: Song[]): Song[] => {
              const songMap = new Map(songs.map((s) => [s.id, s]))
              const reordered: Song[] = []
              songIds.forEach((id, index) => {
                const song = songMap.get(id)
                if (song) {
                  reordered.push({ ...song, rank: index + 1 })
                }
              })
              return reordered
            }

            const newTheme = { ...t, updatedAt: Date.now() }
            if (tier === 'finalists') {
              newTheme.finalists = reorderArray(t.finalists)
            } else if (tier === 'semifinalists') {
              newTheme.semifinalists = reorderArray(t.semifinalists)
            } else if (tier === 'candidates') {
              newTheme.candidates = reorderArray(t.candidates)
            }

            return newTheme
          }),
        }))
      },

      // === Playlist Sync ===
      setThemePlaylist: (themeId: string, tier: FunnelTier, playlistId: string, playlistUrl: string) => {
        set((state) => ({
          themes: state.themes.map((t) =>
            t.id === themeId
              ? {
                  ...t,
                  spotifyPlaylist: {
                    playlistId,
                    playlistUrl,
                    syncedTier: tier,
                    lastSyncAt: Date.now(),
                  },
                  updatedAt: Date.now(),
                }
              : t
          ),
        }))
      },

      setPhase: (phase) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, phase, updatedAt: Date.now() }
              : s
          ),
        }))
      },

      setTheme: (theme) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, theme, updatedAt: Date.now() }
              : s
          ),
        }))
      },

      setWorkingCandidates: (songs) => {
        // Assign IDs to songs that don't have them
        const songsWithIds = songs.map((song) => ({
          ...song,
          id: song.id || generateSongId(),
        }))

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, workingCandidates: songsWithIds, candidates: songsWithIds, updatedAt: Date.now() }
              : s
          ),
        }))
      },

      setCandidates: (songs) => {
        // Legacy alias - calls setWorkingCandidates
        get().setWorkingCandidates(songs)
      },

      updateCandidate: (songId, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== state.activeSessionId) return s
            const updateSong = (song: Song) =>
              song.id === songId ? { ...song, ...updates } : song
            return {
              ...s,
              workingCandidates: (s.workingCandidates || []).map(updateSong),
              candidates: s.candidates.map(updateSong),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      toggleFavorite: (songId) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== state.activeSessionId) return s
            const toggleSong = (song: Song) =>
              song.id === songId ? { ...song, isFavorite: !song.isFavorite } : song
            return {
              ...s,
              workingCandidates: (s.workingCandidates || []).map(toggleSong),
              candidates: s.candidates.map(toggleSong),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      setFinalists: (songs) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, finalists: songs, phase: 'finalists', updatedAt: Date.now() }
              : s
          ),
        }))
      },

      addToFinalists: (song) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== state.activeSessionId) return s
            if (s.finalists.some((f) => f.id === song.id)) return s
            return {
              ...s,
              finalists: [...s.finalists, song],
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      removeFromFinalists: (songId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? {
                  ...s,
                  finalists: s.finalists.filter((song) => song.id !== songId),
                  updatedAt: Date.now(),
                }
              : s
          ),
        }))
      },

      addToConversation: (role, content) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? {
                  ...s,
                  conversationHistory: [
                    ...s.conversationHistory,
                    { role, content, timestamp: Date.now() },
                  ],
                  updatedAt: Date.now(),
                }
              : s
          ),
        }))
      },

      clearConversation: () => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, conversationHistory: [], updatedAt: Date.now() }
              : s
          ),
        }))
      },

      addPreferenceEvidence: (role, content) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? {
                  ...s,
                  preferenceEvidence: [
                    ...(s.preferenceEvidence ?? []),
                    { role, content, timestamp: Date.now() },
                  ],
                  updatedAt: Date.now(),
                }
              : s
          ),
        }))
      },

      setPlaylistCreated: (platform, playlistId, playlistUrl) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? {
                  ...s,
                  playlistCreated: {
                    platform,
                    playlistId,
                    playlistUrl,
                    createdAt: Date.now(),
                  },
                  updatedAt: Date.now(),
                }
              : s
          ),
        }))
      },

      incrementIteration: () => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, iterationCount: s.iterationCount + 1, updatedAt: Date.now() }
              : s
          ),
        }))
      },

      // Rejected Songs Management
      addRejectedSong: (song: RejectedSong) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? {
                  ...s,
                  rejectedSongs: [...(s.rejectedSongs || []), song],
                  updatedAt: Date.now(),
                }
              : s
          ),
        }))
      },

      addRejectedSongs: (songs: RejectedSong[]) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? {
                  ...s,
                  rejectedSongs: [...(s.rejectedSongs || []), ...songs],
                  updatedAt: Date.now(),
                }
              : s
          ),
        }))
      },

      isRejected: (title: string, artist: string) => {
        const session = get().activeSession()
        if (!session?.rejectedSongs) return false
        const normalizedTitle = title.toLowerCase().trim()
        const normalizedArtist = artist.toLowerCase().trim()
        return session.rejectedSongs.some(
          (r) =>
            r.title.toLowerCase().trim() === normalizedTitle &&
            r.artist.toLowerCase().trim() === normalizedArtist
        )
      },

      // Session Preferences Management
      addSessionPreference: (pref: SessionPreference) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? {
                  ...s,
                  sessionPreferences: [...(s.sessionPreferences || []), pref],
                  updatedAt: Date.now(),
                }
              : s
          ),
        }))
      },

      addSessionPreferences: (prefs: SessionPreference[]) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? {
                  ...s,
                  sessionPreferences: [...(s.sessionPreferences || []), ...prefs],
                  updatedAt: Date.now(),
                }
              : s
          ),
        }))
      },

      clearSessionPreferences: () => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, sessionPreferences: [], updatedAt: Date.now() }
              : s
          ),
        }))
      },

      // Long-Term Preferences Management
      addLongTermPreferences: (prefs: LongTermPreference[]) => {
        set((state) => {
          if (!state.userProfile) {
            // Initialize user profile if it doesn't exist
            return {
              userProfile: {
                summary: 'Preference profile being built',
                categories: {
                  genres: [],
                  eras: [],
                  moods: [],
                  instrumentation: [],
                  vocals: [],
                  lyrics: [],
                  riskAppetite: [],
                  nostalgia: [],
                  dislikes: [],
                  misc: [],
                },
                longTermPreferences: prefs,
                evidenceCount: prefs.length,
                weight: 0.5,
                updatedAt: Date.now(),
              },
            }
          }

          // Add to existing profile, avoiding duplicates
          const existingStatements = new Set(
            (state.userProfile.longTermPreferences || []).map((p) =>
              p.statement.toLowerCase()
            )
          )
          const newPrefs = prefs.filter(
            (p) => !existingStatements.has(p.statement.toLowerCase())
          )

          return {
            userProfile: {
              ...state.userProfile,
              longTermPreferences: [
                ...(state.userProfile.longTermPreferences || []),
                ...newPrefs,
              ],
              evidenceCount: state.userProfile.evidenceCount + newPrefs.length,
              updatedAt: Date.now(),
            },
          }
        })
      },

      removeLongTermPreference: (statement: string) => {
        set((state) => {
          if (!state.userProfile) return state
          return {
            userProfile: {
              ...state.userProfile,
              longTermPreferences: (
                state.userProfile.longTermPreferences || []
              ).filter((p) => p.statement !== statement),
              updatedAt: Date.now(),
            },
          }
        })
      },

      // Final Pick
      setFinalPick: (song: Song) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, finalPick: song, phase: 'complete', updatedAt: Date.now() }
              : s
          ),
        }))
      },

      setProcessing: (processing) => {
        set({ isProcessing: processing })
      },

      setError: (error) => {
        set({ error })
      },

      setUserProfile: (profile) => {
        set({ userProfile: profile })
      },

      setStrategistModel: (model) => {
        set({ strategistModel: model })
      },

      // === Export ===
      exportFunnelSummary: (themeId: string) => {
        const theme = get().themes.find((t) => t.id === themeId)
        if (!theme) return 'Theme not found'

        const lines: string[] = [
          `# ${theme.title}`,
          `Theme: ${theme.rawTheme}`,
          '',
        ]

        if (theme.interpretation) {
          lines.push(`Interpretation: ${theme.interpretation}`, '')
        }

        if (theme.pick) {
          lines.push('## PICK')
          lines.push(`- "${theme.pick.title}" by ${theme.pick.artist}`)
          lines.push('')
        }

        if (theme.finalists.length > 0) {
          lines.push(`## Finalists (${theme.finalists.length}/${FUNNEL_TIER_LIMITS.finalists})`)
          theme.finalists.forEach((s, i) => {
            lines.push(`${i + 1}. "${s.title}" by ${s.artist}`)
          })
          lines.push('')
        }

        if (theme.semifinalists.length > 0) {
          lines.push(`## Semifinalists (${theme.semifinalists.length}/${FUNNEL_TIER_LIMITS.semifinalists})`)
          theme.semifinalists.forEach((s, i) => {
            lines.push(`${i + 1}. "${s.title}" by ${s.artist}`)
          })
          lines.push('')
        }

        if (theme.candidates.length > 0) {
          lines.push(`## Candidates (${theme.candidates.length}/${FUNNEL_TIER_LIMITS.candidates})`)
          theme.candidates.forEach((s, i) => {
            lines.push(`${i + 1}. "${s.title}" by ${s.artist}`)
          })
          lines.push('')
        }

        if (theme.deadline) {
          const deadline = new Date(theme.deadline)
          lines.push(`Deadline: ${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString()}`)
        }

        return lines.join('\n')
      },
    }),
    {
      name: 'music-league-strategist',
      version: 2,
      partialize: (state) => ({
        themes: state.themes,
        activeThemeId: state.activeThemeId,
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        userProfile: state.userProfile,
        strategistModel: state.strategistModel,
        _version: state._version,
      }),
    }
  )
)

// Helper: Format candidate list for AI context
export function formatCandidatesForPrompt(candidates: Song[]): string {
  if (candidates.length === 0) return 'No candidates yet.'
  return candidates
    .map((song, i) => {
      const favorite = song.isFavorite ? ' *' : ''
      const year = song.year ? ` (${song.year})` : ''
      const genre = song.genre ? ` [${song.genre}]` : ''
      return `${i + 1}. "${song.title}" by ${song.artist}${year}${genre}${favorite}\n   Reason: ${song.reason}\n   Question: ${song.question || 'N/A'}`
    })
    .join('\n\n')
}

// Helper: Format rejected songs for AI context
export function formatRejectedSongsForPrompt(rejectedSongs: RejectedSong[]): string {
  if (!rejectedSongs || rejectedSongs.length === 0) return 'None'
  return rejectedSongs
    .map((r) => `- "${r.title}" by ${r.artist} (Reason: ${r.reason})`)
    .join('\n')
}

// Helper: Format session preferences for AI context
export function formatSessionPreferencesForPrompt(prefs: SessionPreference[]): string {
  if (!prefs || prefs.length === 0) return 'None learned yet'
  return prefs
    .map((p) => `- [${p.confidence}] ${p.statement}`)
    .join('\n')
}

// Helper: Format long-term preferences for AI context
export function formatLongTermPreferencesForPrompt(prefs: LongTermPreference[]): string {
  if (!prefs || prefs.length === 0) return 'None'
  // Sort by specificity (general first) then by weight
  const sorted = [...prefs].sort((a, b) => {
    if (a.specificity !== b.specificity) {
      return a.specificity === 'general' ? -1 : 1
    }
    return b.weight - a.weight
  })
  return sorted
    .map((p) => `- [${p.specificity}, ${Math.round(p.weight * 100)}%] ${p.statement}`)
    .join('\n')
}

// Helper: Format finalists for AI context
export function formatFinalistsForPrompt(finalists: Song[]): string {
  if (finalists.length === 0) return 'No finalists selected.'
  return finalists
    .map((song, i) => `${i + 1}. [${song.id}] "${song.title}" by ${song.artist} - ${song.reason}`)
    .join('\n')
}

// Helper: Format funnel state for AI context (NEW)
export function formatFunnelForPrompt(theme: MusicLeagueTheme): string {
  const parts: string[] = []

  if (theme.pick) {
    parts.push(`PICK: "${theme.pick.title}" by ${theme.pick.artist}`)
  }

  if (theme.finalists.length > 0) {
    parts.push(`\nFINALISTS (${theme.finalists.length}/${FUNNEL_TIER_LIMITS.finalists}):`)
    theme.finalists.forEach((s, i) => {
      parts.push(`  ${i + 1}. "${s.title}" by ${s.artist}`)
    })
  }

  if (theme.semifinalists.length > 0) {
    parts.push(`\nSEMIFINALISTS (${theme.semifinalists.length}/${FUNNEL_TIER_LIMITS.semifinalists}):`)
    theme.semifinalists.forEach((s, i) => {
      parts.push(`  ${i + 1}. "${s.title}" by ${s.artist}`)
    })
  }

  if (theme.candidates.length > 0) {
    parts.push(`\nCANDIDATES (${theme.candidates.length}/${FUNNEL_TIER_LIMITS.candidates}):`)
    theme.candidates.forEach((s, i) => {
      parts.push(`  ${i + 1}. "${s.title}" by ${s.artist}`)
    })
  }

  if (parts.length === 0) {
    return 'Empty funnel - no songs added yet.'
  }

  return parts.join('\n')
}

// Get system prompt for conversation mode
export function getConversationPrompt(
  session: MusicLeagueSession,
  userProfile: MusicLeagueUserProfile | null
): string {
  let prompt = MUSIC_LEAGUE_PROMPTS.conversation_system

  // Add current context
  const contextParts: string[] = []

  if (session.theme) {
    contextParts.push(`=== CURRENT THEME ===\n${session.theme.rawTheme}`)
    if (session.theme.interpretation) {
      contextParts.push(`Interpretation: ${session.theme.interpretation}`)
    }
  }

  if (session.candidates.length > 0) {
    contextParts.push(`\n=== CURRENT CANDIDATES (${session.candidates.length}) ===\n${formatCandidatesForPrompt(session.candidates)}`)
  }

  // Add rejected songs (CRITICAL: AI must not re-propose these)
  if (session.rejectedSongs && session.rejectedSongs.length > 0) {
    contextParts.push(`\n=== REJECTED SONGS (DO NOT RE-PROPOSE) ===\n${formatRejectedSongsForPrompt(session.rejectedSongs)}`)
  }

  // Add session preferences (learned this session)
  if (session.sessionPreferences && session.sessionPreferences.length > 0) {
    contextParts.push(`\n=== SESSION PREFERENCES (from this conversation) ===\n${formatSessionPreferencesForPrompt(session.sessionPreferences)}`)
  }

  // Add long-term preferences from user profile
  if (userProfile?.longTermPreferences && userProfile.longTermPreferences.length > 0) {
    contextParts.push(`\n=== LONG-TERM PREFERENCES (general preferences, prioritize these) ===\n${formatLongTermPreferencesForPrompt(userProfile.longTermPreferences)}`)
  }

  if (session.playlistCreated) {
    contextParts.push(`\n=== PLAYLIST CREATED ===\nPlatform: ${session.playlistCreated.platform}\nURL: ${session.playlistCreated.playlistUrl}\nNOTE: Assume the player has listened to these songs. Ask follow-up questions about what they heard.`)
  }

  if (userProfile) {
    const profileStr = [
      `\n=== PLAYER PROFILE (${Math.round(userProfile.weight * 100)}% confidence) ===`,
      `Summary: ${userProfile.summary}`,
      `Genres: ${userProfile.categories.genres.join(', ') || '-'}`,
      `Eras: ${userProfile.categories.eras.join(', ') || '-'}`,
      `Moods: ${userProfile.categories.moods.join(', ') || '-'}`,
      `Risk Appetite: ${userProfile.categories.riskAppetite.join(', ') || '-'}`,
      `Dislikes: ${userProfile.categories.dislikes.join(', ') || '-'}`,
    ].join('\n')
    contextParts.push(profileStr)
  }

  if (contextParts.length > 0) {
    prompt += '\n\n' + contextParts.join('\n')
  }

  return prompt
}

// Get system prompt with theme funnel context (NEW)
export function getConversationPromptWithTheme(
  session: MusicLeagueSession,
  theme: MusicLeagueTheme | undefined,
  aggregatedRejectedSongs: RejectedSong[],
  aggregatedPreferences: SessionPreference[],
  userProfile: MusicLeagueUserProfile | null
): string {
  let prompt = MUSIC_LEAGUE_PROMPTS.conversation_system

  const contextParts: string[] = []

  // Theme context
  if (theme) {
    contextParts.push(`=== CURRENT THEME ===\nTitle: ${theme.title}\nPrompt: ${theme.rawTheme}`)
    if (theme.interpretation) {
      contextParts.push(`Interpretation: ${theme.interpretation}`)
    }
    if (theme.deadline) {
      const deadline = new Date(theme.deadline)
      const now = new Date()
      const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      contextParts.push(`Deadline: ${deadline.toLocaleDateString()} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`)
    }

    // Funnel state
    contextParts.push(`\n=== FUNNEL STATE ===\n${formatFunnelForPrompt(theme)}`)
  } else if (session.theme) {
    // Fallback to session theme
    contextParts.push(`=== CURRENT THEME ===\n${session.theme.rawTheme}`)
    if (session.theme.interpretation) {
      contextParts.push(`Interpretation: ${session.theme.interpretation}`)
    }
  }

  // Working candidates (session-specific)
  const workingCandidates = session.workingCandidates || session.candidates || []
  if (workingCandidates.length > 0) {
    contextParts.push(`\n=== SESSION WORKING SET (${workingCandidates.length}) ===\n${formatCandidatesForPrompt(workingCandidates)}`)
  }

  // Aggregated rejected songs from all theme sessions
  if (aggregatedRejectedSongs.length > 0) {
    contextParts.push(`\n=== REJECTED SONGS (DO NOT RE-PROPOSE) ===\n${formatRejectedSongsForPrompt(aggregatedRejectedSongs)}`)
  }

  // Aggregated preferences from all theme sessions
  if (aggregatedPreferences.length > 0) {
    contextParts.push(`\n=== THEME PREFERENCES (from all sessions) ===\n${formatSessionPreferencesForPrompt(aggregatedPreferences)}`)
  }

  // Long-term preferences from user profile
  if (userProfile?.longTermPreferences && userProfile.longTermPreferences.length > 0) {
    contextParts.push(`\n=== LONG-TERM PREFERENCES ===\n${formatLongTermPreferencesForPrompt(userProfile.longTermPreferences)}`)
  }

  if (session.playlistCreated) {
    contextParts.push(`\n=== PLAYLIST CREATED ===\nPlatform: ${session.playlistCreated.platform}\nURL: ${session.playlistCreated.playlistUrl}\nNOTE: Assume the player has listened to these songs. Ask follow-up questions about what they heard.`)
  }

  if (userProfile) {
    const profileStr = [
      `\n=== PLAYER PROFILE (${Math.round(userProfile.weight * 100)}% confidence) ===`,
      `Summary: ${userProfile.summary}`,
      `Genres: ${userProfile.categories.genres.join(', ') || '-'}`,
      `Eras: ${userProfile.categories.eras.join(', ') || '-'}`,
      `Moods: ${userProfile.categories.moods.join(', ') || '-'}`,
      `Risk Appetite: ${userProfile.categories.riskAppetite.join(', ') || '-'}`,
      `Dislikes: ${userProfile.categories.dislikes.join(', ') || '-'}`,
    ].join('\n')
    contextParts.push(profileStr)
  }

  if (contextParts.length > 0) {
    prompt += '\n\n' + contextParts.join('\n')
  }

  return prompt
}

// Get system prompt for finalists mode
export function getFinalistsPrompt(session: MusicLeagueSession): string {
  return MUSIC_LEAGUE_PROMPTS.finalists_system.replace(
    '{finalistsList}',
    formatFinalistsForPrompt(session.finalists)
  )
}

// Get system prompt for long-term preference extraction
export function getLongTermPreferencePrompt(
  sessionPreferences: SessionPreference[],
  existingPreferences: LongTermPreference[]
): string {
  return MUSIC_LEAGUE_PROMPTS.longterm_preference_extraction
    .replace('{sessionPreferences}', formatSessionPreferencesForPrompt(sessionPreferences))
    .replace('{existingPreferences}', formatLongTermPreferencesForPrompt(existingPreferences))
}
