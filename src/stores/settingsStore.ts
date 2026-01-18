import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Available AI models for the dropdown
export const AI_MODELS = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'google/gemini-pro', name: 'Gemini Pro' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
] as const

interface SpotifyConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
}

interface YouTubeMusicConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
}

interface SettingsState {
  // OpenRouter
  openRouterKey: string
  defaultModel: string

  // Spotify OAuth
  spotify: SpotifyConfig

  // YouTube Music OAuth
  youtubeMusic: YouTubeMusicConfig

  // Actions
  setOpenRouterKey: (key: string) => void
  setDefaultModel: (model: string) => void
  setSpotifyConfig: (config: Partial<SpotifyConfig>) => void
  setYouTubeMusicConfig: (config: Partial<YouTubeMusicConfig>) => void
  resetToDefaults: () => void
}

// Read defaults from environment variables
const getEnvDefaults = () => ({
  openRouterKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
  defaultModel: import.meta.env.VITE_DEFAULT_MODEL || 'anthropic/claude-sonnet-4',
  spotify: {
    clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID || '',
    clientSecret: import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || '',
    refreshToken: import.meta.env.VITE_SPOTIFY_REFRESH_TOKEN || '',
  },
  youtubeMusic: {
    clientId: import.meta.env.VITE_YOUTUBE_CLIENT_ID || '',
    clientSecret: import.meta.env.VITE_YOUTUBE_CLIENT_SECRET || '',
    refreshToken: import.meta.env.VITE_YOUTUBE_REFRESH_TOKEN || '',
  },
})

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => {
      const defaults = getEnvDefaults()

      return {
        // Initial state from env
        ...defaults,

        // Actions
        setOpenRouterKey: (key) => set({ openRouterKey: key }),

        setDefaultModel: (model) => set({ defaultModel: model }),

        setSpotifyConfig: (config) =>
          set((state) => ({
            spotify: { ...state.spotify, ...config },
          })),

        setYouTubeMusicConfig: (config) =>
          set((state) => ({
            youtubeMusic: { ...state.youtubeMusic, ...config },
          })),

        resetToDefaults: () => set(getEnvDefaults()),
      }
    },
    {
      name: 'music-league-settings',
      // Merge with env defaults on hydration
      merge: (persistedState, currentState) => {
        const envDefaults = getEnvDefaults()
        const persisted = persistedState as Partial<SettingsState> | undefined

        return {
          ...currentState,
          // Use persisted values if they exist, otherwise fall back to env defaults
          openRouterKey: persisted?.openRouterKey || envDefaults.openRouterKey,
          defaultModel: persisted?.defaultModel || envDefaults.defaultModel,
          spotify: {
            clientId: persisted?.spotify?.clientId || envDefaults.spotify.clientId,
            clientSecret: persisted?.spotify?.clientSecret || envDefaults.spotify.clientSecret,
            refreshToken: persisted?.spotify?.refreshToken || envDefaults.spotify.refreshToken,
          },
          youtubeMusic: {
            clientId: persisted?.youtubeMusic?.clientId || envDefaults.youtubeMusic.clientId,
            clientSecret: persisted?.youtubeMusic?.clientSecret || envDefaults.youtubeMusic.clientSecret,
            refreshToken: persisted?.youtubeMusic?.refreshToken || envDefaults.youtubeMusic.refreshToken,
          },
        }
      },
    }
  )
)

// Helper to check if OpenRouter is configured
export const isOpenRouterConfigured = (): boolean => {
  return Boolean(useSettingsStore.getState().openRouterKey)
}

// Helper to check if Spotify is configured
export const isSpotifyConfigured = (): boolean => {
  const { clientId, clientSecret, refreshToken } = useSettingsStore.getState().spotify
  return Boolean(clientId && clientSecret && refreshToken)
}

// Helper to check if YouTube Music is configured
export const isYouTubeMusicConfigured = (): boolean => {
  const { clientId, clientSecret, refreshToken } = useSettingsStore.getState().youtubeMusic
  return Boolean(clientId && clientSecret && refreshToken)
}
