import { useState } from 'react'
import { RefreshCw, ExternalLink, Music2, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { spotifyService } from '@/services/spotify'
import type { MusicLeagueTheme, FunnelTier, Song } from '@/types/musicLeague'
import { cn } from '@/lib/utils'

interface PlaylistSyncPanelProps {
  theme: MusicLeagueTheme
  className?: string
}

const TIER_OPTIONS: { value: FunnelTier; label: string }[] = [
  { value: 'candidates', label: 'Candidates' },
  { value: 'semifinalists', label: 'Semifinalists' },
  { value: 'finalists', label: 'Finalists' },
  { value: 'pick', label: 'Pick' },
]

function getSongsForTier(theme: MusicLeagueTheme, tier: FunnelTier): Song[] {
  switch (tier) {
    case 'pick':
      return theme.pick ? [theme.pick] : []
    case 'finalists':
      return theme.finalists
    case 'semifinalists':
      return theme.semifinalists
    case 'candidates':
      return theme.candidates
  }
}

export function PlaylistSyncPanel({ theme, className }: PlaylistSyncPanelProps): React.ReactElement {
  const { setThemePlaylist } = useMusicLeagueStore()
  const [selectedTier, setSelectedTier] = useState<FunnelTier>('finalists')
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{ added: number; removed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasPlaylist = !!theme.spotifyPlaylist
  const songs = getSongsForTier(theme, selectedTier)
  const songCount = songs.length

  const handleSync = async (): Promise<void> => {
    if (songCount === 0) {
      setError('No songs in this tier to sync')
      return
    }

    const configCheck = spotifyService.checkConfiguration()
    if (!configCheck.configured) {
      setError(configCheck.error || 'Spotify not configured')
      return
    }

    setIsSyncing(true)
    setError(null)
    setLastSyncResult(null)

    try {
      const title = `ML: ${theme.title} (${selectedTier})`
      const description = `Music League ${selectedTier} for "${theme.title}". Synced via Music League Strategist.`

      const result = await spotifyService.createOrSyncTierPlaylist(
        title,
        description,
        songs,
        theme.spotifyPlaylist?.playlistId
      )

      setThemePlaylist(theme.id, selectedTier, result.playlistId, result.playlistUrl)
      setLastSyncResult({ added: result.added, removed: result.removed })

      // Open playlist in new tab
      window.open(result.playlistUrl, '_blank', 'noopener')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync playlist'
      setError(message)
    } finally {
      setIsSyncing(false)
    }
  }

  const formatLastSync = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString()
  }

  return (
    <div className={cn('rounded-lg border p-3', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Music2 className="h-4 w-4 text-green-500" />
        <span className="font-medium text-sm">Spotify Sync</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Select
          value={selectedTier}
          onValueChange={(value) => setSelectedTier(value as FunnelTier)}
        >
          <SelectTrigger className="h-8 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label} ({getSongsForTier(theme, opt.value).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleSync}
          disabled={isSyncing || songCount === 0}
          size="sm"
          className="gap-1"
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {hasPlaylist ? 'Sync' : 'Create'}
        </Button>
      </div>

      {/* Status */}
      {error && (
        <p className="text-xs text-destructive mb-2">{error}</p>
      )}

      {lastSyncResult && (
        <div className="flex items-center gap-2 text-xs text-green-600 mb-2">
          <Check className="h-3 w-3" />
          <span>
            {lastSyncResult.added > 0 && `Added ${lastSyncResult.added}`}
            {lastSyncResult.added > 0 && lastSyncResult.removed > 0 && ', '}
            {lastSyncResult.removed > 0 && `Removed ${lastSyncResult.removed}`}
            {lastSyncResult.added === 0 && lastSyncResult.removed === 0 && 'Already in sync'}
          </span>
        </div>
      )}

      {hasPlaylist && theme.spotifyPlaylist && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Synced: {theme.spotifyPlaylist.syncedTier} · {formatLastSync(theme.spotifyPlaylist.lastSyncAt)}
          </span>
          <a
            href={theme.spotifyPlaylist.playlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {songCount === 0 && (
        <p className="text-xs text-muted-foreground">
          No songs in {selectedTier}. Add songs to sync.
        </p>
      )}
    </div>
  )
}

// Compact sync button for inline use
export function QuickSyncButton({ theme }: { theme: MusicLeagueTheme }): React.ReactElement {
  const { setThemePlaylist } = useMusicLeagueStore()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleQuickSync = async (): Promise<void> => {
    // Sync finalists by default, or semifinalists if no finalists
    const tier: FunnelTier = theme.finalists.length > 0 ? 'finalists' :
      theme.semifinalists.length > 0 ? 'semifinalists' : 'candidates'
    const songs = getSongsForTier(theme, tier)

    if (songs.length === 0) return

    const configCheck = spotifyService.checkConfiguration()
    if (!configCheck.configured) return

    setIsSyncing(true)

    try {
      const title = `ML: ${theme.title}`
      const description = `Music League candidates. Synced via Music League Strategist.`

      const result = await spotifyService.createOrSyncTierPlaylist(
        title,
        description,
        songs,
        theme.spotifyPlaylist?.playlistId
      )

      setThemePlaylist(theme.id, tier, result.playlistId, result.playlistUrl)
      window.open(result.playlistUrl, '_blank', 'noopener')
    } catch (err) {
      console.error('Quick sync failed:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  const hasAnySongs = theme.finalists.length > 0 ||
    theme.semifinalists.length > 0 ||
    theme.candidates.length > 0

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleQuickSync}
      disabled={isSyncing || !hasAnySongs}
      className="gap-1"
    >
      {isSyncing ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Music2 className="h-3 w-3 text-green-500" />
      )}
      Spotify
    </Button>
  )
}
