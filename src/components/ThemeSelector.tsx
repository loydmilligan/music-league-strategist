import { Plus, Archive, CheckCircle, Calendar } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import type { MusicLeagueTheme } from '@/types/musicLeague'
import { cn } from '@/lib/utils'
import { DeadlineIndicator } from '@/components/DeadlineIndicator'
import { PhaseBadge } from '@/components/PhaseProgressBar'

interface ThemeSelectorProps {
  onNewTheme?: () => void
  className?: string
}

function getStatusBadge(theme: MusicLeagueTheme): React.ReactElement | null {
  if (theme.status === 'archived') {
    return (
      <Badge variant="secondary" className="ml-2 text-xs">
        <Archive className="mr-1 h-3 w-3" />
        Archived
      </Badge>
    )
  }
  if (theme.status === 'submitted') {
    return (
      <Badge variant="default" className="ml-2 text-xs bg-green-600">
        <CheckCircle className="mr-1 h-3 w-3" />
        Submitted
      </Badge>
    )
  }
  if (theme.deadline) {
    return <DeadlineIndicator deadline={theme.deadline} className="ml-2" />
  }
  return null
}

// Helper to format datetime for input
function formatDateTimeForInput(timestamp: number | undefined): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  // Format: YYYY-MM-DDTHH:MM
  return date.toISOString().slice(0, 16)
}

// Helper to parse datetime input to timestamp
function parseDateTimeInput(value: string): number | undefined {
  if (!value) return undefined
  return new Date(value).getTime()
}

export function ThemeSelector({ onNewTheme, className }: ThemeSelectorProps): React.ReactElement {
  const { themes, activeThemeId, setActiveTheme, createTheme, setThemeDeadline, activeTheme } = useMusicLeagueStore()

  const activeThemes = themes.filter((t) => t.status === 'active')
  const archivedThemes = themes.filter((t) => t.status === 'archived' || t.status === 'submitted')
  const currentTheme = activeTheme()

  const handleNewTheme = (): void => {
    if (onNewTheme) {
      onNewTheme()
    } else {
      // Create a new theme with a placeholder - user will enter the actual theme
      const id = createTheme('New Theme')
      setActiveTheme(id)
    }
  }

  const handleDeadlineChange = (value: string): void => {
    if (!activeThemeId) return
    const deadline = parseDateTimeInput(value)
    setThemeDeadline(activeThemeId, deadline)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select
        value={activeThemeId ?? ''}
        onValueChange={(value) => setActiveTheme(value || null)}
      >
        <SelectTrigger className="h-8 w-[200px] text-sm">
          <SelectValue placeholder="Select theme..." />
        </SelectTrigger>
        <SelectContent>
          {activeThemes.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Active Themes
              </div>
              {activeThemes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>
                  <div className="flex items-center">
                    <span className="truncate max-w-[150px]">{theme.title}</span>
                    {getStatusBadge(theme)}
                  </div>
                </SelectItem>
              ))}
            </>
          )}
          {archivedThemes.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground mt-2">
                Archived
              </div>
              {archivedThemes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>
                  <div className="flex items-center opacity-60">
                    <span className="truncate max-w-[150px]">{theme.title}</span>
                    {getStatusBadge(theme)}
                  </div>
                </SelectItem>
              ))}
            </>
          )}
          {themes.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No themes yet
            </div>
          )}
        </SelectContent>
      </Select>

      {/* Deadline Picker (Feature 2) */}
      {activeThemeId && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'h-8 w-8',
                currentTheme?.deadline && 'border-primary'
              )}
              title="Set Deadline"
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="space-y-2">
              <Label htmlFor="deadline" className="text-xs font-medium">
                Deadline
              </Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={formatDateTimeForInput(currentTheme?.deadline)}
                onChange={(e) => handleDeadlineChange(e.target.value)}
                className="w-full"
              />
              {currentTheme?.deadline && (
                <div className="flex items-center justify-between">
                  <DeadlineIndicator deadline={currentTheme.deadline} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive"
                    onClick={() => handleDeadlineChange('')}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Phase Badge (Feature 3) */}
      {currentTheme?.phase && currentTheme.phase !== 'idle' && (
        <PhaseBadge phase={currentTheme.phase} />
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleNewTheme}
        title="New Theme"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

// Compact version for mobile header
export function ThemeSelectorCompact({ className }: { className?: string }): React.ReactElement {
  const { themes, activeThemeId, setActiveTheme, activeTheme } = useMusicLeagueStore()
  const theme = activeTheme()

  const getFunnelSummary = (t: MusicLeagueTheme): string => {
    const parts: string[] = []
    if (t.pick) parts.push('1 pick')
    if (t.finalists.length > 0) parts.push(`${t.finalists.length} finalists`)
    if (t.semifinalists.length > 0) parts.push(`${t.semifinalists.length} semis`)
    if (t.candidates.length > 0) parts.push(`${t.candidates.length} candidates`)
    return parts.length > 0 ? parts.join(', ') : 'Empty funnel'
  }

  return (
    <Select
      value={activeThemeId ?? ''}
      onValueChange={(value) => setActiveTheme(value || null)}
    >
      <SelectTrigger className={cn('h-7 w-[140px] text-xs', className)}>
        <SelectValue placeholder="Theme">
          {theme ? (
            <span className="truncate">{theme.title}</span>
          ) : (
            'Select theme'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {themes.map((t) => (
          <SelectItem key={t.id} value={t.id} className="text-xs">
            <div className="flex flex-col">
              <span className="truncate max-w-[120px]">{t.title}</span>
              <span className="text-[10px] text-muted-foreground">
                {getFunnelSummary(t)}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
