/**
 * Server Sync Hook
 * Handles loading data from PostgreSQL server and syncing writes
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { api, ApiError } from '@/services/api'
import type {
  MusicLeagueTheme,
  MusicLeagueSession,
  MusicLeagueUserProfile,
  SavedSong,
  CompetitorAnalysisData,
} from '@/types/musicLeague'

interface SyncState {
  isInitialized: boolean
  isLoading: boolean
  error: string | null
  migrationNeeded: boolean
  isMigrating: boolean
}

// Helper to check if API is available
async function isApiAvailable(): Promise<boolean> {
  try {
    await api.health()
    return true
  } catch {
    return false
  }
}

// Get localStorage data for migration
function getLocalStorageData(): {
  themes: MusicLeagueTheme[]
  sessions: MusicLeagueSession[]
  userProfile: MusicLeagueUserProfile | null
  songsILike: SavedSong[]
  competitorAnalysis: CompetitorAnalysisData | null
} | null {
  try {
    const stored = localStorage.getItem('music-league-strategist')
    if (!stored) return null

    const data = JSON.parse(stored)
    if (!data.state) return null

    return {
      themes: data.state.themes || [],
      sessions: data.state.sessions || [],
      userProfile: data.state.userProfile || null,
      songsILike: data.state.songsILike || [],
      competitorAnalysis: data.state.competitorAnalysis || null,
    }
  } catch {
    return null
  }
}

// Get localStorage settings for migration
function getLocalStorageSettings() {
  try {
    const stored = localStorage.getItem('music-league-settings')
    if (!stored) return null

    const data = JSON.parse(stored)
    return data.state || null
  } catch {
    return null
  }
}

export function useServerSync() {
  const [state, setState] = useState<SyncState>({
    isInitialized: false,
    isLoading: true,
    error: null,
    migrationNeeded: false,
    isMigrating: false,
  })

  const initAttempted = useRef(false)

  // Store setters (using individual selectors to avoid re-render loops)
  const setThemesFromServer = useMusicLeagueStore((s) => s.setThemesFromServer)
  const setSessionsFromServer = useMusicLeagueStore((s) => s.setSessionsFromServer)
  const setUserProfile = useMusicLeagueStore((s) => s.setUserProfile)
  const setSongsILikeFromServer = useMusicLeagueStore((s) => s.setSongsILikeFromServer)
  const setCompetitorAnalysis = useMusicLeagueStore((s) => s.setCompetitorAnalysis)

  // Settings store setters
  const setOpenRouterKey = useSettingsStore((s) => s.setOpenRouterKey)
  const setDefaultModel = useSettingsStore((s) => s.setDefaultModel)
  const setSpotify = useSettingsStore((s) => s.setSpotify)
  const setYoutubeMusic = useSettingsStore((s) => s.setYoutubeMusic)
  const setNtfy = useSettingsStore((s) => s.setNtfy)

  // Initialize from server
  const initialize = useCallback(async () => {
    if (initAttempted.current) return
    initAttempted.current = true

    setState((s) => ({ ...s, isLoading: true, error: null }))

    try {
      // Check if API is available
      const apiAvailable = await isApiAvailable()

      if (!apiAvailable) {
        console.log('API not available, using localStorage only')
        setState((s) => ({
          ...s,
          isInitialized: true,
          isLoading: false,
          error: 'Server unavailable. Using local data only.',
        }))
        return
      }

      // Check if server has data
      const { hasData: serverHasData } = await api.hasData()
      const localData = getLocalStorageData()
      const hasLocalData = localData && (localData.themes.length > 0 || localData.sessions.length > 0)

      // If server is empty but we have local data, offer migration
      if (!serverHasData && hasLocalData) {
        setState((s) => ({
          ...s,
          isLoading: false,
          migrationNeeded: true,
        }))
        return
      }

      // Load from server
      const [themes, sessions, profile, savedSongs, competitorData, settings] = await Promise.all([
        api.getThemes(),
        api.getSessions(),
        api.getProfile().catch(() => null),
        api.getSavedSongs().catch(() => []),
        api.getCompetitorAnalysis().catch(() => null),
        api.getSettings().catch(() => null),
      ])

      // Update stores with server data
      if (setThemesFromServer) setThemesFromServer(themes)
      if (setSessionsFromServer) setSessionsFromServer(sessions)
      if (profile && setUserProfile) setUserProfile(profile)
      if (setSongsILikeFromServer) setSongsILikeFromServer(savedSongs)
      if (competitorData && setCompetitorAnalysis) setCompetitorAnalysis(competitorData)

      // Update settings store with server settings
      // Only overwrite if server has actual values (not empty strings)
      if (settings) {
        if (settings.openRouterKey) setOpenRouterKey(settings.openRouterKey)
        if (settings.defaultModel) setDefaultModel(settings.defaultModel)
        // Only sync spotify if server has actual credentials
        if (settings.spotify?.clientId && settings.spotify?.refreshToken) {
          setSpotify(settings.spotify)
        }
        // Only sync youtube if server has actual credentials
        if (settings.youtubeMusic?.clientId && settings.youtubeMusic?.refreshToken) {
          setYoutubeMusic(settings.youtubeMusic)
        }
        if (settings.ntfy) setNtfy(settings.ntfy)
      }

      setState((s) => ({
        ...s,
        isInitialized: true,
        isLoading: false,
      }))

      console.log('Initialized from server:', {
        themes: themes.length,
        sessions: sessions.length,
      })
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Failed to load from server'

      console.error('Server sync initialization failed:', err)
      setState((s) => ({
        ...s,
        isInitialized: true,
        isLoading: false,
        error: message,
      }))
    }
  }, [setThemesFromServer, setSessionsFromServer, setUserProfile, setSongsILikeFromServer, setCompetitorAnalysis, setOpenRouterKey, setDefaultModel, setSpotify, setYoutubeMusic, setNtfy])

  // Migrate local data to server
  const migrateToServer = useCallback(async () => {
    setState((s) => ({ ...s, isMigrating: true, error: null }))

    try {
      const localData = getLocalStorageData()
      const localSettings = getLocalStorageSettings()

      if (!localData) {
        throw new Error('No local data to migrate')
      }

      // Call migration endpoint
      await api.migrate({
        themes: localData.themes,
        sessions: localData.sessions,
        userProfile: localData.userProfile || undefined,
        songsILike: localData.songsILike,
        competitorAnalysis: localData.competitorAnalysis || undefined,
        settings: localSettings,
      })

      // Clear localStorage after successful migration
      localStorage.removeItem('music-league-strategist')
      localStorage.removeItem('music-league-settings')

      // Now load from server
      initAttempted.current = false
      setState((s) => ({
        ...s,
        isMigrating: false,
        migrationNeeded: false,
      }))

      // Re-initialize to load migrated data
      await initialize()

      console.log('Migration completed successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Migration failed'
      console.error('Migration failed:', err)
      setState((s) => ({
        ...s,
        isMigrating: false,
        error: message,
      }))
    }
  }, [initialize])

  // Skip migration and use server (empty start)
  const skipMigration = useCallback(async () => {
    setState((s) => ({ ...s, migrationNeeded: false }))
    initAttempted.current = false
    await initialize()
  }, [initialize])

  // Initialize on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  return {
    ...state,
    migrateToServer,
    skipMigration,
    retry: () => {
      initAttempted.current = false
      initialize()
    },
  }
}

// Hook to sync theme changes to server
export function useThemeSync() {
  const syncThemeToServer = useCallback(async (theme: MusicLeagueTheme) => {
    try {
      await api.updateTheme(theme.id, theme)
    } catch (err) {
      console.error('Failed to sync theme to server:', err)
    }
  }, [])

  const createThemeOnServer = useCallback(async (theme: MusicLeagueTheme): Promise<string | null> => {
    try {
      const created = await api.createTheme(theme)
      return created.id
    } catch (err) {
      console.error('Failed to create theme on server:', err)
      return null
    }
  }, [])

  const deleteThemeOnServer = useCallback(async (themeId: string) => {
    try {
      await api.deleteTheme(themeId)
    } catch (err) {
      console.error('Failed to delete theme on server:', err)
    }
  }, [])

  return {
    syncThemeToServer,
    createThemeOnServer,
    deleteThemeOnServer,
  }
}

// Hook to sync settings to server
export function useSettingsSync() {
  const settings = useSettingsStore()

  const syncSettingsToServer = useCallback(async () => {
    try {
      await api.updateSettings({
        openRouterKey: settings.openRouterKey,
        defaultModel: settings.defaultModel,
        spotify: settings.spotify,
        youtubeMusic: settings.youtubeMusic,
        ntfy: settings.ntfy,
      })
    } catch (err) {
      console.error('Failed to sync settings to server:', err)
    }
  }, [settings])

  const loadSettingsFromServer = useCallback(async () => {
    try {
      const serverSettings = await api.getSettings()
      // Update local store with server settings
      // Only overwrite if server has actual values (not empty strings)
      if (serverSettings.openRouterKey) {
        settings.setOpenRouterKey(serverSettings.openRouterKey)
      }
      if (serverSettings.defaultModel) {
        settings.setDefaultModel(serverSettings.defaultModel)
      }
      // Only sync spotify if server has actual credentials
      if (serverSettings.spotify?.clientId && serverSettings.spotify?.refreshToken) {
        settings.setSpotify(serverSettings.spotify)
      }
      // Only sync youtube if server has actual credentials
      if (serverSettings.youtubeMusic?.clientId && serverSettings.youtubeMusic?.refreshToken) {
        settings.setYoutubeMusic(serverSettings.youtubeMusic)
      }
      if (serverSettings.ntfy) {
        settings.setNtfy(serverSettings.ntfy)
      }
    } catch (err) {
      console.error('Failed to load settings from server:', err)
    }
  }, [settings])

  return {
    syncSettingsToServer,
    loadSettingsFromServer,
  }
}
