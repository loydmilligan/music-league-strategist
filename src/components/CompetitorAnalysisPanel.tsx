// CompetitorAnalysisPanel Component (Feature 7)
// Displays competitor analysis from imported CSV data

import { useState } from 'react'
import {
  Trophy,
  Medal,
  User,
  Music,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Trash2,
  ListMusic,
  Loader2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { CSVImportModal } from './CSVImportModal'
import { spotifyService } from '@/services/spotify'
import type { CompetitorProfile, RoundResults, Song } from '@/types/musicLeague'
import { cn } from '@/lib/utils'

interface CompetitorAnalysisPanelProps {
  trigger?: React.ReactNode
  className?: string
}

function CompetitorCard({
  competitor,
  rank,
}: {
  competitor: CompetitorProfile
  rank: number
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)

  const getRankIcon = () => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-amber-500" />
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />
    return <span className="text-xs text-muted-foreground">#{rank}</span>
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center">
              {getRankIcon()}
            </div>
            <div>
              <p className="font-medium text-sm">{competitor.name}</p>
              <p className="text-xs text-muted-foreground">
                {competitor.submissions?.length ?? 0} rounds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-medium text-sm">{competitor.totalPoints} pts</p>
              <p className="text-xs text-muted-foreground">
                avg {competitor.averagePoints.toFixed(1)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {competitor.wins > 0 && (
                <Badge variant="default" className="bg-amber-500 text-xs">
                  {competitor.wins} {competitor.wins === 1 ? 'win' : 'wins'}
                </Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-11 pr-3 pb-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Submissions</p>
          {(competitor.submissions ?? [])
            .sort((a, b) => b.pointsReceived - a.pointsReceived)
            .slice(0, 5)
            .map((submission, idx) => (
              <div
                key={`${submission.roundId}-${idx}`}
                className="flex items-center justify-between text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    "{submission.title}" - {submission.artist}
                  </p>
                  <p className="text-muted-foreground truncate">
                    {submission.roundName}
                  </p>
                </div>
                <Badge
                  variant={submission.rank === 1 ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] ml-2',
                    submission.rank === 1 && 'bg-amber-500'
                  )}
                >
                  #{submission.rank} ({submission.pointsReceived}pts)
                </Badge>
              </div>
            ))}
          {competitor.submissions.length > 5 && (
            <p className="text-xs text-muted-foreground">
              + {competitor.submissions.length - 5} more
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function RoundCard({ round }: { round: RoundResults }): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const top3 = (round.rankings ?? []).filter(r => r.rank <= 3)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{round.roundName}</p>
            <p className="text-xs text-muted-foreground">
              {round.rankings?.length ?? 0} submissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {top3.length > 0 && (
              <div className="flex -space-x-1">
                {top3.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                      idx === 0 && 'bg-amber-500',
                      idx === 1 && 'bg-gray-400',
                      idx === 2 && 'bg-amber-600'
                    )}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
            )}
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Rankings</p>
          {(round.rankings ?? []).slice(0, 10).map((ranking, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={cn(
                    'w-5 text-center font-medium',
                    ranking.rank === 1 && 'text-amber-500',
                    ranking.rank === 2 && 'text-gray-400',
                    ranking.rank === 3 && 'text-amber-600'
                  )}
                >
                  #{ranking.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    "{ranking.title}" - {ranking.artist}
                  </p>
                  <p className="text-muted-foreground">
                    {ranking.submitterName}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] ml-2">
                {ranking.totalPoints}pts
              </Badge>
            </div>
          ))}
          {round.rankings.length > 10 && (
            <p className="text-xs text-muted-foreground">
              + {round.rankings.length - 10} more
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function CompetitorAnalysisPanel({
  trigger,
  className,
}: CompetitorAnalysisPanelProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [playlistError, setPlaylistError] = useState<string | null>(null)

  const { competitorAnalysis, clearCompetitorAnalysis, setRecommendationPlaylist } = useMusicLeagueStore()

  const hasData = competitorAnalysis !== null
  const hasPlaylist = !!competitorAnalysis?.recommendationPlaylistUrl

  // Get top 3 songs from all rounds
  const getTop3Songs = (): Song[] => {
    if (!competitorAnalysis?.roundResults) return []

    const songs: Song[] = []
    for (const round of competitorAnalysis.roundResults) {
      const top3 = (round.rankings || []).filter((r) => r.rank <= 3)
      for (const ranking of top3) {
        songs.push({
          id: `${round.roundId}-${ranking.spotifyUri}`,
          title: ranking.title,
          artist: ranking.artist,
          spotifyUri: ranking.spotifyUri,
          reason: `#${ranking.rank} in "${round.roundName}" with ${ranking.totalPoints} points`,
        })
      }
    }
    return songs
  }

  const handleCreatePlaylist = async (): Promise<void> => {
    if (!competitorAnalysis) return

    setIsCreatingPlaylist(true)
    setPlaylistError(null)

    try {
      const songs = getTop3Songs()
      if (songs.length === 0) {
        throw new Error('No songs found in rounds')
      }

      const leagueName = competitorAnalysis.leagueName || 'Music League'
      const title = `${leagueName} - Top Songs`
      const description = `Top 3 songs from ${competitorAnalysis.roundResults?.length || 0} rounds. Created by Music League Strategist.`

      const { playlistId, playlistUrl } = await spotifyService.createPlaylist(
        title,
        description,
        songs
      )

      setRecommendationPlaylist(playlistId, playlistUrl)
    } catch (error) {
      console.error('Failed to create playlist:', error)
      setPlaylistError(error instanceof Error ? error.message : 'Failed to create playlist')
    } finally {
      setIsCreatingPlaylist(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className={cn('gap-2', className)}>
            <BarChart3 className="h-4 w-4" />
            Competitors
            {hasData && (
              <Badge variant="secondary" className="ml-1">
                {competitorAnalysis.competitors?.length ?? 0}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Competitor Analysis
            </div>
            {hasData && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (confirm('Clear all imported data?')) {
                    clearCompetitorAnalysis()
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        {!hasData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
            <h3 className="font-medium mb-2">No Data Imported</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Import your Music League CSV exports to analyze competitor performance.
            </p>
            <CSVImportModal />
          </div>
        ) : (
          <>
            {/* Summary Header */}
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {competitorAnalysis.leagueName || 'Music League'}
                </span>
                <CSVImportModal
                  mergeMode
                  trigger={
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                      <RefreshCw className="h-3 w-3" />
                      Update Data
                    </Button>
                  }
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {competitorAnalysis.competitors?.length ?? 0} competitors
                  </div>
                  <div className="flex items-center gap-1">
                    <Music className="h-3 w-3" />
                    {competitorAnalysis.roundResults?.length ?? 0} rounds
                  </div>
                </div>
                <span className="text-muted-foreground">
                  Updated {new Date(competitorAnalysis.importedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Recommendation Playlist Section */}
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListMusic className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Recommendation Playlist</span>
                </div>
                {hasPlaylist ? (
                  <a
                    href={competitorAnalysis.recommendationPlaylistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-500 hover:text-green-400"
                  >
                    Open in Spotify
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 min-h-[44px] text-xs"
                    onClick={handleCreatePlaylist}
                    disabled={isCreatingPlaylist}
                  >
                    {isCreatingPlaylist ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <ListMusic className="h-3 w-3" />
                        Create Playlist
                      </>
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {hasPlaylist
                  ? `${getTop3Songs().length} songs from top 3 of each round`
                  : `Create a Spotify playlist with top 3 songs from all ${competitorAnalysis.roundResults?.length ?? 0} rounds`}
              </p>
              {playlistError && (
                <p className="text-xs text-red-500 mt-1">{playlistError}</p>
              )}
            </div>

            <Tabs defaultValue="leaderboard" className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-2">
                <TabsTrigger value="leaderboard" className="text-xs">
                  <Trophy className="h-3 w-3 mr-1" />
                  Leaderboard
                </TabsTrigger>
                <TabsTrigger value="rounds" className="text-xs">
                  <Music className="h-3 w-3 mr-1" />
                  Rounds
                </TabsTrigger>
              </TabsList>

              <TabsContent value="leaderboard" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {(competitorAnalysis.competitors ?? []).map((competitor, idx) => (
                      <CompetitorCard
                        key={competitor.id}
                        competitor={competitor}
                        rank={idx + 1}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="rounds" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {(competitorAnalysis.roundResults ?? []).map((round) => (
                      <RoundCard key={round.roundId} round={round} />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// Compact trigger button for header
export function CompetitorAnalysisButton({
  className,
}: {
  className?: string
}): React.ReactElement {
  const competitorAnalysis = useMusicLeagueStore((s) => s.competitorAnalysis)
  const hasData = competitorAnalysis !== null

  return (
    <CompetitorAnalysisPanel
      className={className}
      trigger={
        <Button variant="ghost" size="icon" className={cn('h-8 w-8 relative', className)}>
          <BarChart3 className="h-4 w-4" />
          {hasData && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      }
    />
  )
}
