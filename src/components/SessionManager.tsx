import { Plus, MessageSquare } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { cn } from '@/lib/utils'

interface SessionManagerProps {
  className?: string
}

export function SessionManager({ className }: SessionManagerProps): React.ReactElement {
  const {
    activeThemeId,
    activeSessionId,
    getThemeSessions,
    resumeSession,
    createSessionForTheme,
  } = useMusicLeagueStore()

  const sessions = activeThemeId ? getThemeSessions(activeThemeId) : []

  const handleNewSession = (): void => {
    if (activeThemeId) {
      createSessionForTheme(activeThemeId)
    }
  }

  const formatSessionTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select
        value={activeSessionId ?? ''}
        onValueChange={(value) => resumeSession(value)}
        disabled={!activeThemeId}
      >
        <SelectTrigger className="h-8 w-[160px] text-sm">
          <SelectValue placeholder="Select session..." />
        </SelectTrigger>
        <SelectContent>
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate max-w-[100px]">{session.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatSessionTime(session.updatedAt)}
                  </span>
                </div>
              </SelectItem>
            ))
          ) : (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              {activeThemeId ? 'No sessions yet' : 'Select a theme first'}
            </div>
          )}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleNewSession}
        disabled={!activeThemeId}
        title="New Session"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

// Compact version for mobile
export function SessionSelectorCompact({ className }: { className?: string }): React.ReactElement {
  const {
    activeThemeId,
    activeSessionId,
    activeSession,
    getThemeSessions,
    resumeSession,
  } = useMusicLeagueStore()

  const sessions = activeThemeId ? getThemeSessions(activeThemeId) : []
  const session = activeSession()

  return (
    <Select
      value={activeSessionId ?? ''}
      onValueChange={(value) => resumeSession(value)}
      disabled={!activeThemeId}
    >
      <SelectTrigger className={cn('h-7 w-[100px] text-xs', className)}>
        <SelectValue placeholder="Session">
          {session ? (
            <span className="truncate">{session.title}</span>
          ) : (
            'Session'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {sessions.map((s) => (
          <SelectItem key={s.id} value={s.id} className="text-xs">
            <span className="truncate">{s.title}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Session info badge showing message count
export function SessionBadge(): React.ReactElement | null {
  const { activeSession } = useMusicLeagueStore()
  const session = activeSession()

  if (!session) return null

  const messageCount = session.conversationHistory.length

  return (
    <Badge variant="outline" className="text-xs">
      {messageCount} {messageCount === 1 ? 'msg' : 'msgs'}
    </Badge>
  )
}
