/**
 * Store Sync Module
 * Subscribes to store changes and syncs to server
 */

import { create } from 'zustand'
import { api } from '@/services/api'
import { useMusicLeagueStore } from './musicLeagueStore'
import type { MusicLeagueTheme, MusicLeagueSession, SavedSong } from '@/types/musicLeague'

const SYNC_DEBOUNCE_MS = 1000
let syncTimeout: ReturnType<typeof setTimeout> | null = null

// Sync status store
interface SyncStatusState {
  isSyncing: boolean
  lastSyncTime: Date | null
  syncError: string | null
  pendingChanges: boolean
  setSyncing: (syncing: boolean) => void
  setSyncError: (error: string | null) => void
  setLastSyncTime: (time: Date) => void
  setPendingChanges: (pending: boolean) => void
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  pendingChanges: false,
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setSyncError: (error) => set({ syncError: error }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  setPendingChanges: (pending) => set({ pendingChanges: pending }),
}))

function hasChanged<T>(a: T, b: T): boolean {
  return JSON.stringify(a) !== JSON.stringify(b)
}

async function syncThemes(current: MusicLeagueTheme[], previous: MusicLeagueTheme[]): Promise<void> {
  const promises: Promise<unknown>[] = []

  // Create or update themes
  current.forEach((theme) => {
    const prevTheme = previous.find((t) => t.id === theme.id)
    if (!prevTheme) {
      console.log('[Sync] Creating theme:', theme.id)
      promises.push(api.createTheme(theme))
    } else if (hasChanged(theme, prevTheme)) {
      console.log('[Sync] Updating theme:', theme.id)
      promises.push(api.updateTheme(theme.id, theme))
    }
  })

  // Delete removed themes
  previous.forEach((prevTheme) => {
    if (!current.find((t) => t.id === prevTheme.id)) {
      console.log('[Sync] Deleting theme:', prevTheme.id)
      promises.push(api.deleteTheme(prevTheme.id))
    }
  })

  await Promise.all(promises)
}

async function syncSessions(current: MusicLeagueSession[], previous: MusicLeagueSession[]): Promise<void> {
  const promises: Promise<unknown>[] = []

  // Create or update sessions
  current.forEach((session) => {
    const prevSession = previous.find((s) => s.id === session.id)
    if (!prevSession) {
      console.log('[Sync] Creating session:', session.id)
      promises.push(api.createSession(session))
    } else if (hasChanged(session, prevSession)) {
      console.log('[Sync] Updating session:', session.id)
      promises.push(api.updateSession(session.id, session))
    }
  })

  // Delete removed sessions
  previous.forEach((prevSession) => {
    if (!current.find((s) => s.id === prevSession.id)) {
      console.log('[Sync] Deleting session:', prevSession.id)
      promises.push(api.deleteSession(prevSession.id))
    }
  })

  await Promise.all(promises)
}

async function syncSavedSongs(current: SavedSong[], previous: SavedSong[]): Promise<void> {
  const promises: Promise<unknown>[] = []

  // Add new songs
  current.forEach((song) => {
    if (!previous.find((s) => s.id === song.id)) {
      console.log('[Sync] Saving song:', song.id)
      promises.push(api.saveSong(song, song.tags, song.notes, song.sourceThemeId))
    }
  })

  // Remove deleted songs
  previous.forEach((prevSong) => {
    if (!current.find((s) => s.id === prevSong.id)) {
      console.log('[Sync] Removing saved song:', prevSong.id)
      promises.push(api.removeSavedSong(prevSong.id))
    }
  })

  await Promise.all(promises)
}

// Force sync all data to server
export async function forceSyncAll(): Promise<void> {
  const { setSyncing, setSyncError, setLastSyncTime, setPendingChanges } = useSyncStatus.getState()
  const state = useMusicLeagueStore.getState()

  setSyncing(true)
  setSyncError(null)

  try {
    const promises: Promise<unknown>[] = []

    // Sync all themes
    state.themes.forEach((theme) => {
      promises.push(
        api.updateTheme(theme.id, theme).catch(() => api.createTheme(theme))
      )
    })

    // Sync all sessions
    state.sessions.forEach((session) => {
      promises.push(
        api.updateSession(session.id, session).catch(() => api.createSession(session))
      )
    })

    // Sync profile
    if (state.userProfile) {
      promises.push(api.updateProfile(state.userProfile))
    }

    // Sync saved songs
    state.songsILike.forEach((song) => {
      promises.push(api.saveSong(song, song.tags, song.notes, song.sourceThemeId))
    })

    await Promise.all(promises)

    setLastSyncTime(new Date())
    setPendingChanges(false)
    console.log('[Sync] Force sync completed successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed'
    setSyncError(errorMessage)
    console.error('[Sync] Force sync failed:', error)
    throw error
  } finally {
    setSyncing(false)
  }
}

let previousState = useMusicLeagueStore.getState()

export function initializeStoreSync(): () => void {
  console.log('[Sync] Initializing store sync...')
  const { setSyncing, setSyncError, setLastSyncTime, setPendingChanges } = useSyncStatus.getState()

  const unsubscribe = useMusicLeagueStore.subscribe((state) => {
    // Mark pending changes immediately
    const hasThemeChanges = state.themes !== previousState.themes
    const hasSessionChanges = state.sessions !== previousState.sessions
    const hasProfileChanges = state.userProfile !== previousState.userProfile
    const hasSongChanges = state.songsILike !== previousState.songsILike

    if (hasThemeChanges || hasSessionChanges || hasProfileChanges || hasSongChanges) {
      setPendingChanges(true)
    }

    // Clear any pending sync
    if (syncTimeout) clearTimeout(syncTimeout)

    // Debounce sync to avoid too many API calls
    syncTimeout = setTimeout(async () => {
      const prev = previousState
      previousState = state

      try {
        setSyncing(true)
        setSyncError(null)

        // Sync themes if changed
        if (state.themes !== prev.themes) {
          await syncThemes(state.themes, prev.themes)
        }

        // Sync sessions if changed
        if (state.sessions !== prev.sessions) {
          await syncSessions(state.sessions, prev.sessions)
        }

        // Sync user profile if changed
        if (state.userProfile !== prev.userProfile && state.userProfile) {
          console.log('[Sync] Updating profile')
          await api.updateProfile(state.userProfile)
        }

        // Sync songs I like if changed
        if (state.songsILike !== prev.songsILike) {
          await syncSavedSongs(state.songsILike, prev.songsILike)
        }

        setLastSyncTime(new Date())
        setPendingChanges(false)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Sync failed'
        setSyncError(errorMessage)
        console.error('[Sync] Sync failed:', error)
      } finally {
        setSyncing(false)
      }
    }, SYNC_DEBOUNCE_MS)
  })

  return unsubscribe
}
