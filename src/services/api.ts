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

const API_BASE = '/api/ml'

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

export const api = {
  // ============================================================================
  // THEMES
  // ============================================================================

  getThemes: (): Promise<MusicLeagueTheme[]> => fetchApi('/themes'),

  getTheme: (id: string): Promise<MusicLeagueTheme> => fetchApi(`/themes/${id}`),

  createTheme: (data: Partial<MusicLeagueTheme>): Promise<MusicLeagueTheme> =>
    fetchApi('/themes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTheme: (id: string, data: Partial<MusicLeagueTheme>): Promise<MusicLeagueTheme> =>
    fetchApi(`/themes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTheme: (id: string): Promise<void> =>
    fetchApi(`/themes/${id}`, { method: 'DELETE' }),

  // ============================================================================
  // SONGS (within themes)
  // ============================================================================

  addSongToTheme: (themeId: string, song: Song, tier: FunnelTier): Promise<Song> =>
    fetchApi(`/themes/${themeId}/songs`, {
      method: 'POST',
      body: JSON.stringify({ song, tier }),
    }),

  updateSong: (
    themeId: string,
    songId: string,
    data: { tier?: FunnelTier; song?: Partial<Song> }
  ): Promise<Song> =>
    fetchApi(`/themes/${themeId}/songs/${songId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  removeSong: (themeId: string, songId: string): Promise<void> =>
    fetchApi(`/themes/${themeId}/songs/${songId}`, { method: 'DELETE' }),

  // ============================================================================
  // SESSIONS
  // ============================================================================

  getSessions: (): Promise<MusicLeagueSession[]> => fetchApi('/sessions'),

  getSession: (id: string): Promise<MusicLeagueSession> => fetchApi(`/sessions/${id}`),

  createSession: (data: Partial<MusicLeagueSession>): Promise<MusicLeagueSession> =>
    fetchApi('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSession: (id: string, data: Partial<MusicLeagueSession>): Promise<MusicLeagueSession> =>
    fetchApi(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSession: (id: string): Promise<void> =>
    fetchApi(`/sessions/${id}`, { method: 'DELETE' }),

  addMessage: (sessionId: string, message: ApiChatMessage): Promise<void> =>
    fetchApi(`/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    }),

  // ============================================================================
  // USER PROFILE
  // ============================================================================

  getProfile: (): Promise<MusicLeagueUserProfile> => fetchApi('/profile'),

  updateProfile: (data: Partial<MusicLeagueUserProfile>): Promise<{ success: boolean }> =>
    fetchApi('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ============================================================================
  // SAVED SONGS (Songs I Like)
  // ============================================================================

  getSavedSongs: (): Promise<SavedSong[]> => fetchApi('/saved-songs'),

  saveSong: (
    song: Song,
    tags?: string[],
    notes?: string,
    sourceThemeId?: string
  ): Promise<{ success: boolean; songId: string }> =>
    fetchApi('/saved-songs', {
      method: 'POST',
      body: JSON.stringify({ song, tags, notes, sourceThemeId }),
    }),

  removeSavedSong: (songId: string): Promise<void> =>
    fetchApi(`/saved-songs/${songId}`, { method: 'DELETE' }),

  // ============================================================================
  // COMPETITOR ANALYSIS
  // ============================================================================

  getCompetitorAnalysis: (): Promise<CompetitorAnalysisData | null> =>
    fetchApi('/competitor-analysis'),

  importCompetitorAnalysis: (
    leagueName: string,
    data: CompetitorAnalysisData
  ): Promise<{ success: boolean }> =>
    fetchApi('/competitor-analysis', {
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
