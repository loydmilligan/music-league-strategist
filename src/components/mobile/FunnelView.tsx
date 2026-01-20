import { useState } from 'react'
import {
  Trophy,
  Medal,
  Target,
  Users,
  ChevronDown,
  ChevronUp,
  Play,
  MoreVertical,
  Trash2,
  Volume2,
  VolumeX,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import type { Song, FunnelTier } from '@/types/musicLeague'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { PlaylistSyncPanel } from '@/components/PlaylistSyncPanel'

const TIER_CONFIG = {
  pick: {
    label: 'Pick',
    icon: Trophy,
    limit: 1,
    color: 'tier-pick',
    description: 'Your final submission'
  },
  finalists: {
    label: 'Finalists',
    icon: Medal,
    limit: 4,
    color: 'tier-finalists',
    description: 'Top contenders'
  },
  semifinalists: {
    label: 'Semifinalists',
    icon: Target,
    limit: 8,
    color: 'tier-semifinalists',
    description: 'Strong candidates'
  },
  candidates: {
    label: 'Candidates',
    icon: Users,
    limit: 30,
    color: 'tier-candidates',
    description: 'Discovery pool'
  }
} as const

interface FunnelViewProps {
  onSongSelect?: (song: Song) => void
}

export function FunnelView({ onSongSelect }: FunnelViewProps): React.ReactElement {
  const [expandedTiers, setExpandedTiers] = useState<Set<FunnelTier>>(
    new Set(['pick', 'finalists'])
  )
  const [playlistPanelOpen, setPlaylistPanelOpen] = useState(false)

  const {
    activeTheme,
    promoteSong,
    demoteSong,
    removeSongFromTier,
    toggleMuted,
  } = useMusicLeagueStore()

  const theme = activeTheme()

  const toggleTier = (tier: FunnelTier) => {
    setExpandedTiers((prev) => {
      const next = new Set(prev)
      if (next.has(tier)) {
        next.delete(tier)
      } else {
        next.add(tier)
      }
      return next
    })
  }

  const getSongsForTier = (tier: FunnelTier): Song[] => {
    if (!theme) return []
    switch (tier) {
      case 'pick':
        return theme.pick ? [theme.pick] : []
      case 'finalists':
        return theme.finalists || []
      case 'semifinalists':
        return theme.semifinalists || []
      case 'candidates':
        return theme.candidates || []
      default:
        return []
    }
  }

  const getNextTier = (tier: FunnelTier): FunnelTier | null => {
    const tiers: FunnelTier[] = ['candidates', 'semifinalists', 'finalists', 'pick']
    const index = tiers.indexOf(tier)
    return index < tiers.length - 1 ? tiers[index + 1] : null
  }

  const getPrevTier = (tier: FunnelTier): FunnelTier | null => {
    const tiers: FunnelTier[] = ['candidates', 'semifinalists', 'finalists', 'pick']
    const index = tiers.indexOf(tier)
    return index > 0 ? tiers[index - 1] : null
  }

  const handlePromote = (song: Song, fromTier: FunnelTier) => {
    if (!theme) return
    const nextTier = getNextTier(fromTier)
    if (nextTier) {
      promoteSong(theme.id, { ...song, currentTier: fromTier }, nextTier, 'Promoted manually')
    }
  }

  const handleDemote = (song: Song, fromTier: FunnelTier) => {
    if (!theme) return
    const prevTier = getPrevTier(fromTier)
    if (prevTier) {
      demoteSong(theme.id, { ...song, currentTier: fromTier }, prevTier, 'Demoted manually')
    }
  }

  const handleRemove = (song: Song, fromTier: FunnelTier) => {
    if (!theme) return
    removeSongFromTier(theme.id, song.id, fromTier)
  }

  const handleToggleMute = (song: Song) => {
    if (!theme) return
    toggleMuted(theme.id, song.id)
  }

  // Calculate total songs
  const totalSongs = theme
    ? (theme.pick ? 1 : 0) +
      (theme.finalists?.length || 0) +
      (theme.semifinalists?.length || 0) +
      (theme.candidates?.length || 0)
    : 0

  if (!theme) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Target className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="font-display text-xl mb-2">No Theme Active</h2>
        <p className="text-muted-foreground text-sm">
          Start a conversation to create a theme and build your funnel.
        </p>
      </div>
    )
  }

  const tiers: FunnelTier[] = ['pick', 'finalists', 'semifinalists', 'candidates']

  return (
    <div className="flex flex-col h-full">
      {/* Header Summary */}
      <div className="px-4 py-3 border-b bg-card/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base line-clamp-1">{theme.title}</h2>
            <p className="text-xs text-muted-foreground">
              {totalSongs} song{totalSongs !== 1 ? 's' : ''} in funnel
            </p>
          </div>
          <Sheet open={playlistPanelOpen} onOpenChange={setPlaylistPanelOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Play className="h-4 w-4 mr-1" />
                Playlist
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[50vh] rounded-t-3xl">
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted" />
              <div className="py-4">
                <h3 className="font-display text-lg mb-4">Sync Playlist</h3>
                <PlaylistSyncPanel theme={theme} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Visual Funnel Progress */}
        <div className="flex items-center gap-1 mt-3">
          {tiers.map((tier, index) => {
            const config = TIER_CONFIG[tier]
            const songs = getSongsForTier(tier)
            const filled = songs.length > 0
            return (
              <div
                key={tier}
                className={cn(
                  'h-2 rounded-full flex-1 transition-all duration-300',
                  filled ? `bg-${config.color}` : 'bg-muted'
                )}
                style={{
                  opacity: filled ? 1 : 0.3,
                  width: `${25 + (3 - index) * 5}%`
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Funnel Tiers */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {tiers.map((tier) => {
            const config = TIER_CONFIG[tier]
            const songs = getSongsForTier(tier)
            const isExpanded = expandedTiers.has(tier)
            const Icon = config.icon

            return (
              <div
                key={tier}
                className={cn(
                  'rounded-2xl border overflow-hidden',
                  'transition-all duration-200',
                  songs.length > 0 ? 'border-border' : 'border-dashed border-muted'
                )}
              >
                {/* Tier Header */}
                <button
                  onClick={() => toggleTier(tier)}
                  className={cn(
                    'w-full flex items-center justify-between p-4',
                    'transition-colors duration-200',
                    songs.length > 0 ? 'bg-card' : 'bg-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center',
                      `tier-badge-${tier}`
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{config.label}</span>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          songs.length > 0
                            ? `bg-${config.color}/20 text-${config.color}`
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {songs.length}/{config.limit}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                  {songs.length > 0 && (
                    <ChevronDown className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-180'
                    )} />
                  )}
                </button>

                {/* Songs */}
                {isExpanded && songs.length > 0 && (
                  <div className="px-4 pb-4 space-y-2">
                    {songs.map((song, index) => (
                      <SongCard
                        key={song.id}
                        song={song}
                        tier={tier}
                        rank={tier !== 'candidates' ? index + 1 : undefined}
                        onPromote={() => handlePromote(song, tier)}
                        onDemote={() => handleDemote(song, tier)}
                        onRemove={() => handleRemove(song, tier)}
                        onToggleMute={() => handleToggleMute(song)}
                        onSelect={() => onSongSelect?.(song)}
                        canPromote={!!getNextTier(tier)}
                        canDemote={!!getPrevTier(tier)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

interface SongCardProps {
  song: Song
  tier: FunnelTier
  rank?: number
  onPromote: () => void
  onDemote: () => void
  onRemove: () => void
  onToggleMute: () => void
  onSelect: () => void
  canPromote: boolean
  canDemote: boolean
}

function SongCard({
  song,
  tier,
  rank,
  onPromote,
  onDemote,
  onRemove,
  onToggleMute,
  onSelect,
  canPromote,
  canDemote
}: SongCardProps): React.ReactElement {
  return (
    <div className={cn(
      'song-card',
      song.isMuted && 'opacity-50',
      song.isEliminated && 'line-through opacity-30'
    )}>
      {/* Rank Badge */}
      {rank !== undefined && (
        <div className={cn(
          'h-7 w-7 rounded-lg flex items-center justify-center',
          'text-xs font-bold',
          `tier-badge-${tier}`
        )}>
          {rank}
        </div>
      )}

      {/* Song Info */}
      <div className="flex-1 min-w-0" onClick={onSelect}>
        <p className="font-medium text-sm truncate">{song.title}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-0.5">
        {canPromote && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-success"
            onClick={(e) => {
              e.stopPropagation()
              onPromote()
            }}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        )}
        {canDemote && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-warning"
            onClick={(e) => {
              e.stopPropagation()
              onDemote()
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}

        {/* More Options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSelect}>
              <Info className="h-4 w-4 mr-2" />
              Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleMute}>
              {song.isMuted ? (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Unmute
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4 mr-2" />
                  Mute
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
