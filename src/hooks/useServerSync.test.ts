import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { useServerSync } from '@/hooks/useServerSync'
import { api } from '@/services/api'

vi.mock('@/services/api', () => {
  return {
    api: {
      health: vi.fn(),
      hasData: vi.fn(),
      getThemes: vi.fn(),
      getSessions: vi.fn(),
      getProfile: vi.fn(),
      getSavedSongs: vi.fn(),
      getCompetitorAnalysis: vi.fn(),
      getSettings: vi.fn(),
      migrate: vi.fn(),
    },
    ApiError: class ApiError extends Error {
      status: number
      constructor(status: number, message: string) {
        super(message)
        this.status = status
      }
    },
  }
})

vi.mock('@/stores/musicLeagueStore', () => {
  return {
    useMusicLeagueStore: (selector: any) => {
      const store = {
        setThemesFromServer: vi.fn(),
        setSessionsFromServer: vi.fn(),
        setUserProfile: vi.fn(),
        setSongsILikeFromServer: vi.fn(),
        setCompetitorAnalysis: vi.fn(),
      }
      return selector(store)
    },
  }
})

vi.mock('@/stores/settingsStore', () => {
  return {
    useSettingsStore: (selector?: any) => {
      const store = {
        openRouterKey: '',
        defaultModel: '',
        spotify: { clientId: '', clientSecret: '', refreshToken: '' },
        youtubeMusic: { clientId: '', clientSecret: '', refreshToken: '' },
        ntfy: { enabled: false, topic: '', serverUrl: 'https://ntfy.sh' },
        setOpenRouterKey: vi.fn(),
        setDefaultModel: vi.fn(),
        setSpotify: vi.fn(),
        setYoutubeMusic: vi.fn(),
        setNtfy: vi.fn(),
      }

      if (!selector) return store
      return selector(store)
    },
  }
})

describe('useServerSync', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetAllMocks()
  })

  it('sets error and initializes when API is unavailable', async () => {
    ;(api.health as any).mockRejectedValueOnce(new Error('nope'))

    const { result } = renderHook(() => useServerSync())

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toMatch(/Server unavailable/i)
  })

  it('loads from server successfully', async () => {
    ;(api.health as any).mockResolvedValueOnce({ status: 'ok', timestamp: new Date().toISOString() })
    ;(api.getThemes as any).mockResolvedValueOnce([])
    ;(api.getSessions as any).mockResolvedValueOnce([])
    ;(api.getProfile as any).mockResolvedValueOnce(null)
    ;(api.getSavedSongs as any).mockResolvedValueOnce([])
    ;(api.getCompetitorAnalysis as any).mockResolvedValueOnce(null)
    ;(api.getSettings as any).mockResolvedValueOnce(null)

    const { result } = renderHook(() => useServerSync())

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })
})
