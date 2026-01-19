import { useState, useCallback, useRef } from 'react'
import {
  Trophy,
  Star,
  ChevronUp,
  ChevronDown,
  X,
  ExternalLink,
  Music,
  Sparkles,
  Info,
  Ticket,
  VolumeX,
  Volume2,
  FileDown,
  FileUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import type { Song, FunnelTier, MusicLeagueTheme } from '@/types/musicLeague'
import { FUNNEL_TIER_LIMITS } from '@/types/musicLeague'
import { cn } from '@/lib/utils'
import { PhaseProgressBar } from '@/components/PhaseProgressBar'

interface FunnelVisualizationProps {
  theme: MusicLeagueTheme
  compact?: boolean
  className?: string
  onSongClick?: (song: Song) => void
}

interface TierConfig {
  tier: FunnelTier
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
}

const TIER_CONFIGS: TierConfig[] = [
  {
    tier: 'pick',
    label: 'PICK',
    icon: <Trophy className="h-4 w-4" />,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/50',
  },
  {
    tier: 'finalists',
    label: 'Finalists',
    icon: <Star className="h-4 w-4" />,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/50',
  },
  {
    tier: 'semifinalists',
    label: 'Semifinalists',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/50',
  },
  {
    tier: 'candidates',
    label: 'Candidates',
    icon: <Music className="h-4 w-4" />,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    borderColor: 'border-border',
  },
]

function getYouTubeUrl(song: Song): string {
  if (song.youtubeVideoId) {
    return `https://www.youtube.com/watch?v=${song.youtubeVideoId}`
  }
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`
}

function getNextTier(currentTier: FunnelTier): FunnelTier | null {
  const tiers: FunnelTier[] = ['candidates', 'semifinalists', 'finalists', 'pick']
  const idx = tiers.indexOf(currentTier)
  return idx < tiers.length - 1 ? tiers[idx + 1] : null
}

function getPrevTier(currentTier: FunnelTier): FunnelTier | null {
  const tiers: FunnelTier[] = ['candidates', 'semifinalists', 'finalists', 'pick']
  const idx = tiers.indexOf(currentTier)
  return idx > 0 ? tiers[idx - 1] : null
}

interface SongCardProps {
  song: Song
  tier: FunnelTier
  themeId: string
  compact?: boolean
  showRank?: boolean
  onInfoClick?: (song: Song) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst?: boolean
  isLast?: boolean
}

function SongCard({
  song,
  tier,
  themeId,
  compact,
  showRank,
  onInfoClick,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SongCardProps): React.ReactElement {
  const { promoteSong, demoteSong, removeSongFromTier, toggleMuted, activeTheme } = useMusicLeagueStore()
  const theme = activeTheme()

  const nextTier = getNextTier(tier)
  const prevTier = getPrevTier(tier)

  const canPromote = nextTier !== null && (
    nextTier === 'pick' ? !theme?.pick :
    nextTier === 'finalists' ? (theme?.finalists.length ?? 0) < FUNNEL_TIER_LIMITS.finalists :
    nextTier === 'semifinalists' ? (theme?.semifinalists.length ?? 0) < FUNNEL_TIER_LIMITS.semifinalists :
    true
  )

  const handlePromote = (): void => {
    if (nextTier) {
      promoteSong(themeId, song, nextTier, 'Manual promotion')
    }
  }

  const handleDemote = (): void => {
    if (prevTier) {
      demoteSong(themeId, song, prevTier, 'Manual demotion')
    }
  }

  const handleRemove = (): void => {
    removeSongFromTier(themeId, song.id, tier)
  }

  const handleToggleMuted = (): void => {
    toggleMuted(themeId, song.id)
  }

  // Show star ratings if available
  const hasRatings = song.ratings && (song.ratings.theme > 0 || song.ratings.general > 0)
  const isMuted = song.isMuted || false

  if (compact) {
    return (
      <div className={cn(
        "flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs",
        isMuted && "opacity-50 bg-muted/50"
      )}>
        {showRank && (
          <div className="flex items-center gap-1">
            <span className="w-4 text-center font-medium text-muted-foreground">
              {song.rank || ''}
            </span>
            <div className="flex flex-col">
              {!isFirst && onMoveUp && (
                <button
                  onClick={onMoveUp}
                  className="h-3 w-3 flex items-center justify-center hover:text-foreground text-muted-foreground"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              )}
              {!isLast && onMoveDown && (
                <button
                  onClick={onMoveDown}
                  className="h-3 w-3 flex items-center justify-center hover:text-foreground text-muted-foreground"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", isMuted && "line-through")}>{song.title}</p>
          <p className="truncate text-muted-foreground">{song.artist}</p>
        </div>
        <div className="flex items-center gap-1">
          {onInfoClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onInfoClick(song)}
              title="View details"
            >
              <Info className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={handleToggleMuted}
            title={isMuted ? 'Unmute (include in playlists)' : 'Mute (exclude from playlists)'}
          >
            {isMuted ? (
              <Volume2 className="h-3 w-3 text-muted-foreground" />
            ) : (
              <VolumeX className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
          {nextTier && canPromote && !isMuted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handlePromote}
              title={`Promote to ${nextTier}`}
            >
              <ChevronUp className="h-3 w-3 text-green-500" />
            </Button>
          )}
          {prevTier && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleDemote}
              title={`Demote to ${prevTier}`}
            >
              <ChevronDown className="h-3 w-3 text-orange-500" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "rounded-lg border p-2 transition-colors hover:bg-accent/50",
      isMuted && "opacity-50 bg-muted/30"
    )}>
      <div className="flex items-start justify-between gap-2">
        {showRank && (
          <div className="flex items-center gap-1 pt-0.5">
            <span className="w-5 text-center font-bold text-muted-foreground">
              {song.rank || ''}
            </span>
            <div className="flex flex-col gap-0.5">
              {!isFirst && onMoveUp && (
                <button
                  onClick={onMoveUp}
                  className="h-4 w-4 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                  title="Move up"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              )}
              {!isLast && onMoveDown && (
                <button
                  onClick={onMoveDown}
                  className="h-4 w-4 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                  title="Move down"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}
        <div
          className={cn(
            'min-w-0 flex-1',
            onInfoClick && 'cursor-pointer'
          )}
          onClick={() => onInfoClick?.(song)}
        >
          <p className={cn("truncate font-medium text-sm", isMuted && "line-through")}>{song.title}</p>
          <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
          {song.year && song.genre && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {song.year} · {song.genre}
            </p>
          )}
          {hasRatings && (
            <div className="flex items-center gap-2 mt-1">
              {song.ratings!.theme > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  {song.ratings!.theme} theme
                </span>
              )}
              {song.ratings!.general > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  {song.ratings!.general} general
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onInfoClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onInfoClick(song)}
              title="View details"
            >
              <Info className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleToggleMuted}
            title={isMuted ? 'Unmute (include in playlists)' : 'Mute (exclude from playlists)'}
          >
            {isMuted ? (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          {nextTier && canPromote && !isMuted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handlePromote}
              title={`Promote to ${nextTier}`}
            >
              <ChevronUp className="h-4 w-4 text-green-500" />
            </Button>
          )}
          {prevTier && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDemote}
              title={`Demote to ${prevTier}`}
            >
              <ChevronDown className="h-4 w-4 text-orange-500" />
            </Button>
          )}
          <a
            href={getYouTubeUrl(song)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent"
            title="Listen on YouTube"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRemove}
            title="Remove from funnel"
          >
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>
      {song.reason && (
        <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">
          {song.reason}
        </p>
      )}
    </div>
  )
}

interface TierSectionProps {
  config: TierConfig
  songs: Song[]
  themeId: string
  compact?: boolean
  onSongClick?: (song: Song) => void
}

function TierSection({ config, songs, themeId, compact, onSongClick }: TierSectionProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(true)
  const { reorderSongsInTier } = useMusicLeagueStore()
  const limit = FUNNEL_TIER_LIMITS[config.tier]
  const count = songs.length
  const isFull = count >= limit

  // Show ranking for semifinalists, finalists, and pick
  const showRank = config.tier === 'semifinalists' || config.tier === 'finalists'

  // Sort songs by rank if available
  const sortedSongs = [...songs].sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank
    if (a.rank) return -1
    if (b.rank) return 1
    return 0
  })

  // Assign ranks if not present
  const songsWithRanks = sortedSongs.map((song, index) => ({
    ...song,
    rank: song.rank || index + 1,
  }))

  const handleMoveUp = useCallback((songId: string) => {
    const index = songsWithRanks.findIndex((s) => s.id === songId)
    if (index <= 0) return

    const newOrder = [...songsWithRanks]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp

    reorderSongsInTier(themeId, config.tier, newOrder.map((s) => s.id))
  }, [songsWithRanks, themeId, config.tier, reorderSongsInTier])

  const handleMoveDown = useCallback((songId: string) => {
    const index = songsWithRanks.findIndex((s) => s.id === songId)
    if (index < 0 || index >= songsWithRanks.length - 1) return

    const newOrder = [...songsWithRanks]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp

    reorderSongsInTier(themeId, config.tier, newOrder.map((s) => s.id))
  }, [songsWithRanks, themeId, config.tier, reorderSongsInTier])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'flex items-center justify-between rounded-t-lg border px-3 py-2 cursor-pointer transition-colors',
            config.bgColor,
            config.borderColor,
            'hover:opacity-90'
          )}
        >
          <div className="flex items-center gap-2">
            <span className={config.color}>{config.icon}</span>
            <span className={cn('font-medium text-sm', config.color)}>
              {config.label}
            </span>
          </div>
          <Badge
            variant={isFull ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {count}/{limit}
          </Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className={cn(
            'rounded-b-lg border border-t-0 p-2 space-y-2',
            config.borderColor
          )}
        >
          {songsWithRanks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              No songs in this tier
            </p>
          ) : (
            songsWithRanks.map((song, index) => (
              <SongCard
                key={song.id}
                song={song}
                tier={config.tier}
                themeId={themeId}
                compact={compact}
                showRank={showRank}
                onInfoClick={onSongClick}
                onMoveUp={showRank ? () => handleMoveUp(song.id) : undefined}
                onMoveDown={showRank ? () => handleMoveDown(song.id) : undefined}
                isFirst={index === 0}
                isLast={index === songsWithRanks.length - 1}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// Funnel export data structure
interface FunnelExportData {
  version: number
  exportedAt: number
  theme: {
    id: string
    title: string
    rawTheme: string
    interpretation?: string
    strategy?: string
  }
  funnel: {
    pick: Song | null
    finalists: Song[]
    semifinalists: Song[]
    candidates: Song[]
  }
}

export function FunnelVisualization({
  theme,
  compact = false,
  className,
  onSongClick,
}: FunnelVisualizationProps): React.ReactElement {
  const { getHallPassesAvailable, computeThemePhase, updateTheme } = useMusicLeagueStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const getSongsForTier = (tier: FunnelTier): Song[] => {
    switch (tier) {
      case 'pick':
        return theme.pick ? [theme.pick] : []
      case 'finalists':
        return theme.finalists ?? []
      case 'semifinalists':
        return theme.semifinalists ?? []
      case 'candidates':
        return theme.candidates ?? []
    }
  }

  // Export funnel data to JSON file
  const handleExport = useCallback(() => {
    const exportData: FunnelExportData = {
      version: 1,
      exportedAt: Date.now(),
      theme: {
        id: theme.id,
        title: theme.title,
        rawTheme: theme.rawTheme,
        interpretation: theme.interpretation,
        strategy: theme.strategy,
      },
      funnel: {
        pick: theme.pick,
        finalists: theme.finalists ?? [],
        semifinalists: theme.semifinalists ?? [],
        candidates: theme.candidates ?? [],
      },
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `funnel-${theme.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [theme])

  // Import funnel data from JSON file
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as FunnelExportData

        // Validate the data
        if (!data.version || !data.funnel) {
          throw new Error('Invalid funnel export file')
        }

        // Update the theme with imported funnel data
        updateTheme(theme.id, {
          pick: data.funnel.pick,
          finalists: data.funnel.finalists ?? [],
          semifinalists: data.funnel.semifinalists ?? [],
          candidates: data.funnel.candidates ?? [],
          // Optionally restore theme interpretation if it was empty
          ...(data.theme.interpretation && !theme.interpretation
            ? { interpretation: data.theme.interpretation }
            : {}),
          ...(data.theme.strategy && !theme.strategy
            ? { strategy: data.theme.strategy }
            : {}),
        })

        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to import funnel')
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
    reader.readAsText(file)
  }, [theme.id, theme.interpretation, theme.strategy, updateTheme])

  // Compute current phase
  const currentPhase = computeThemePhase(theme)

  // Get hall pass availability
  const hallPasses = getHallPassesAvailable(theme.id)

  // Count total songs in funnel
  const totalSongs = (theme.pick ? 1 : 0) +
    (theme.finalists?.length ?? 0) +
    (theme.semifinalists?.length ?? 0) +
    (theme.candidates?.length ?? 0)

  return (
    <div className={cn('space-y-3', className)}>
      {/* Phase Progress (Feature 3) */}
      {!compact && (
        <PhaseProgressBar
          currentPhase={currentPhase}
          candidateCount={theme.candidates?.length ?? 0}
          semifinalistCount={theme.semifinalists?.length ?? 0}
          finalistCount={theme.finalists?.length ?? 0}
          hasPick={theme.pick !== null}
          compact={true}
        />
      )}

      {/* Export/Import Controls */}
      {!compact && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {totalSongs} song{totalSongs !== 1 ? 's' : ''} in funnel
          </span>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={handleExport}
                    disabled={totalSongs === 0}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Export
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Download funnel as backup file
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    Import
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Restore funnel from backup file
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Import Error */}
      {importError && (
        <div className="text-xs text-red-500 bg-red-500/10 rounded px-2 py-1">
          {importError}
        </div>
      )}

      {/* Hall Pass Indicators (Feature 4) */}
      {!compact && (currentPhase === 'refine' || currentPhase === 'decide') && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Hall Passes:</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={hallPasses.semifinals ? 'outline' : 'secondary'}
                  className={cn(
                    'gap-1 cursor-help',
                    hallPasses.semifinals ? 'text-green-500 border-green-500/50' : 'opacity-50'
                  )}
                >
                  <Ticket className="h-3 w-3" />
                  Semi
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {hallPasses.semifinals
                  ? 'Available: Skip directly to semifinalists'
                  : 'Used: Already added a late song to semifinalists'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={hallPasses.finals ? 'outline' : 'secondary'}
                  className={cn(
                    'gap-1 cursor-help',
                    hallPasses.finals ? 'text-purple-500 border-purple-500/50' : 'opacity-50'
                  )}
                >
                  <Ticket className="h-3 w-3" />
                  Finals
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {hallPasses.finals
                  ? 'Available: Skip directly to finalists'
                  : 'Used: Already added a late song to finalists'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {TIER_CONFIGS.map((config) => (
        <TierSection
          key={config.tier}
          config={config}
          songs={getSongsForTier(config.tier)}
          themeId={theme.id}
          compact={compact}
          onSongClick={onSongClick}
        />
      ))}
    </div>
  )
}

// Simple summary for header
export function FunnelSummary({ theme }: { theme: MusicLeagueTheme }): React.ReactElement {
  return (
    <div className="flex items-center gap-1 text-xs">
      {theme.pick && (
        <Badge variant="default" className="bg-amber-500 text-[10px] px-1">
          <Trophy className="h-2.5 w-2.5 mr-0.5" />1
        </Badge>
      )}
      {(theme.finalists?.length ?? 0) > 0 && (
        <Badge variant="outline" className="text-[10px] px-1">
          {theme.finalists?.length ?? 0}F
        </Badge>
      )}
      {(theme.semifinalists?.length ?? 0) > 0 && (
        <Badge variant="outline" className="text-[10px] px-1">
          {theme.semifinalists?.length ?? 0}S
        </Badge>
      )}
      {(theme.candidates?.length ?? 0) > 0 && (
        <Badge variant="outline" className="text-[10px] px-1">
          {theme.candidates?.length ?? 0}C
        </Badge>
      )}
    </div>
  )
}
