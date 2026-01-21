/**
 * API Service for PostgreSQL persistence
 * Handles all communication with the backend API
 */

import type {
  MusicLeagueTheme,
  MusicLeagueSession,
  MusicLeagueUserProfile,
  Song,
  FunnelTier,
  SavedSong,
  CompetitorAnalysisData,
} from '@/types/musicLeague'
import { useAuthStore } from '@/stores/authStore'

const API_BASE = '/api/ml'

// Get auth token from store
const getAuthHeaders = (): Record<string, string> => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    return { 'Authorization': `Bearer ${accessToken}` }
  }
  return {}
}

// Settings type (matches settingsStore)
export interface ApiSettings {
  openRouterKey: string
  defaultModel: string
  spotify: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }
  youtubeMusic: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }
  ntfy: {
    enabled: boolean
    topic: string
    serverUrl: string
  }
}

// AI Model type
export interface ApiAIModel {
  id: string
  modelId: string
  nickname: string
  description?: string
  tags?: string[]
  favorite: boolean
  modelType?: string
  contextLength?: number
  pricing?: Record<string, unknown>
  sortOrder: number
  createdAt: number
  updatedAt: number
}

// Chat message type
export interface ApiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Fetch without auth (for public endpoints like settings, models)
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new ApiError(response.status, `API error ${response.status}: ${errorText}`)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// Fetch with auth (for protected endpoints)
async function fetchAuthApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const makeRequest = async (): Promise<Response> => {
    return fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers,
      },
      ...options,
    })
  }

  let response = await makeRequest()

  // If unauthorized, try to refresh token and retry
  if (response.status === 401 || response.status === 403) {
    const { refreshAccessToken, clearAuth } = useAuthStore.getState()
    const refreshed = await refreshAccessToken()

    if (refreshed) {
      response = await makeRequest()
    } else {
      clearAuth()
      throw new ApiError(401, 'Session expired. Please log in again.')
    }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new ApiError(response.status, `API error ${response.status}: ${errorText}`)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const api = {
  // ============================================================================
  // THEMES (Protected - requires auth)
  // ============================================================================

  getThemes: (): Promise<MusicLeagueTheme[]> => fetchAuthApi('/themes'),

  getTheme: (id: string): Promise<MusicLeagueTheme> => fetchAuthApi(`/themes/${id}`),

  createTheme: (data: Partial<MusicLeagueTheme>): Promise<MusicLeagueTheme> =>
    fetchAuthApi('/themes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTheme: (id: string, data: Partial<MusicLeagueTheme>): Promise<MusicLeagueTheme> =>
    fetchAuthApi(`/themes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTheme: (id: string): Promise<void> =>
    fetchAuthApi(`/themes/${id}`, { method: 'DELETE' }),

  // ============================================================================
  // SONGS (within themes - Protected)
  // ============================================================================

  addSongToTheme: (themeId: string, song: Song, tier: FunnelTier): Promise<Song> =>
    fetchAuthApi(`/themes/${themeId}/songs`, {
      method: 'POST',
      body: JSON.stringify({ song, tier }),
    }),

  updateSong: (
    themeId: string,
    songId: string,
    data: { tier?: FunnelTier; song?: Partial<Song> }
  ): Promise<Song> =>
    fetchAuthApi(`/themes/${themeId}/songs/${songId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  removeSong: (themeId: string, songId: string): Promise<void> =>
    fetchAuthApi(`/themes/${themeId}/songs/${songId}`, { method: 'DELETE' }),

  // ============================================================================
  // SESSIONS (Protected)
  // ============================================================================

  getSessions: (): Promise<MusicLeagueSession[]> => fetchAuthApi('/sessions'),

  getSession: (id: string): Promise<MusicLeagueSession> => fetchAuthApi(`/sessions/${id}`),

  createSession: (data: Partial<MusicLeagueSession>): Promise<MusicLeagueSession> =>
    fetchAuthApi('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSession: (id: string, data: Partial<MusicLeagueSession>): Promise<MusicLeagueSession> =>
    fetchAuthApi(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSession: (id: string): Promise<void> =>
    fetchAuthApi(`/sessions/${id}`, { method: 'DELETE' }),

  addMessage: (sessionId: string, message: ApiChatMessage): Promise<void> =>
    fetchAuthApi(`/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    }),

  // ============================================================================
  // USER PROFILE (Protected)
  // ============================================================================

  getProfile: (): Promise<MusicLeagueUserProfile> => fetchAuthApi('/profile'),

  updateProfile: (data: Partial<MusicLeagueUserProfile>): Promise<{ success: boolean }> =>
    fetchAuthApi('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ============================================================================
  // SAVED SONGS (Songs I Like - Protected)
  // ============================================================================

  getSavedSongs: (): Promise<SavedSong[]> => fetchAuthApi('/saved-songs'),

  saveSong: (
    song: Song,
    tags?: string[],
    notes?: string,
    sourceThemeId?: string
  ): Promise<{ success: boolean; songId: string }> =>
    fetchAuthApi('/saved-songs', {
      method: 'POST',
      body: JSON.stringify({ song, tags, notes, sourceThemeId }),
    }),

  removeSavedSong: (songId: string): Promise<void> =>
    fetchAuthApi(`/saved-songs/${songId}`, { method: 'DELETE' }),

  // ============================================================================
  // COMPETITOR ANALYSIS (Protected)
  // ============================================================================

  getCompetitorAnalysis: (): Promise<CompetitorAnalysisData | null> =>
    fetchAuthApi('/competitor-analysis'),

  importCompetitorAnalysis: (
    leagueName: string,
    data: CompetitorAnalysisData
  ): Promise<{ success: boolean }> =>
    fetchAuthApi('/competitor-analysis', {
      method: 'POST',
      body: JSON.stringify({ leagueName, data }),
    }),

  // ============================================================================
  // SETTINGS
  // ============================================================================

  getSettings: (): Promise<ApiSettings> => fetchApi('/settings'),

  updateSettings: (data: ApiSettings): Promise<{ success: boolean }> =>
    fetchApi('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  patchSettings: (data: Partial<ApiSettings>): Promise<ApiSettings> =>
    fetchApi('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // ============================================================================
  // AI MODELS
  // ============================================================================

  getModels: (): Promise<ApiAIModel[]> => fetchApi('/models'),

  createModel: (data: Partial<ApiAIModel>): Promise<ApiAIModel> =>
    fetchApi('/models', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateModel: (id: string, data: Partial<ApiAIModel>): Promise<ApiAIModel> =>
    fetchApi(`/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteModel: (id: string): Promise<void> =>
    fetchApi(`/models/${id}`, { method: 'DELETE' }),

  // ============================================================================
  // MIGRATION
  // ============================================================================

  migrate: (data: {
    themes?: MusicLeagueTheme[]
    sessions?: MusicLeagueSession[]
    userProfile?: MusicLeagueUserProfile
    songsILike?: SavedSong[]
    settings?: ApiSettings
    competitorAnalysis?: CompetitorAnalysisData
  }): Promise<{ success: boolean; message: string }> =>
    fetchApi('/migrate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  hasData: (): Promise<{ hasData: boolean }> => fetchApi('/has-data'),

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  health: (): Promise<{ status: string; timestamp: string }> => fetchApi('/health'),
}

export { ApiError }
export default api
