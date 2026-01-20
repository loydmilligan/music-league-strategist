import { MessageSquare } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  } = useMusicLeagueStore()

  const sessions = activeThemeId ? getThemeSessions(activeThemeId) : []

  const formatSessionTime = (timestamp: number | string | undefined): string => {
    if (!timestamp) return ''

    // Handle both numeric timestamps and ISO date strings
    const numericTimestamp = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp
    if (isNaN(numericTimestamp)) return ''

    const date = new Date(numericTimestamp)
    if (isNaN(date.getTime())) return ''

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

  const messageCount = session.conversationHistory?.length ?? 0

  return (
    <Badge variant="outline" className="text-xs">
      {messageCount} {messageCount === 1 ? 'msg' : 'msgs'}
    </Badge>
  )
}
