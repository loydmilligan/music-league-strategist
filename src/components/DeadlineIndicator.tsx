// DeadlineIndicator Component (Feature 2)
// Displays countdown to theme deadline with color coding

import { Clock, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface DeadlineIndicatorProps {
  deadline: number
  className?: string
  showLabel?: boolean
}

function getTimeRemaining(deadline: number): {
  totalHours: number
  days: number
  hours: number
  minutes: number
  isOverdue: boolean
} {
  const now = Date.now()
  const diff = deadline - now
  const isOverdue = diff < 0

  const absDiff = Math.abs(diff)
  const totalHours = absDiff / (1000 * 60 * 60)
  const days = Math.floor(totalHours / 24)
  const hours = Math.floor(totalHours % 24)
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60))

  return { totalHours, days, hours, minutes, isOverdue }
}

function formatTimeRemaining(
  days: number,
  hours: number,
  minutes: number,
  isOverdue: boolean
): string {
  if (isOverdue) {
    if (days > 0) return `${days}d overdue`
    if (hours > 0) return `${hours}h overdue`
    return `${minutes}m overdue`
  }

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return `${minutes}m`
}

function getDeadlineColor(totalHours: number, isOverdue: boolean): string {
  if (isOverdue) return 'bg-red-600 text-white'
  if (totalHours < 4) return 'bg-red-500 text-white'
  if (totalHours < 12) return 'bg-orange-500 text-white'
  if (totalHours < 24) return 'bg-yellow-500 text-black'
  return 'bg-green-500 text-white'
}

export function DeadlineIndicator({
  deadline,
  className,
  showLabel = true,
}: DeadlineIndicatorProps): React.ReactElement {
  const { totalHours, days, hours, minutes, isOverdue } = getTimeRemaining(deadline)
  const timeText = formatTimeRemaining(days, hours, minutes, isOverdue)
  const colorClass = getDeadlineColor(totalHours, isOverdue)

  return (
    <Badge
      className={cn(
        'gap-1 font-medium',
        colorClass,
        className
      )}
    >
      {isOverdue ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {showLabel && <span className="text-xs">
        {isOverdue ? 'Overdue' : timeText}
      </span>}
      {!showLabel && <span className="text-xs">{timeText}</span>}
    </Badge>
  )
}

// Compact version for use in lists
export function DeadlineIndicatorCompact({
  deadline,
  className,
}: {
  deadline: number
  className?: string
}): React.ReactElement {
  const { totalHours, days, hours, minutes, isOverdue } = getTimeRemaining(deadline)
  const timeText = formatTimeRemaining(days, hours, minutes, isOverdue)
  const colorClass = getDeadlineColor(totalHours, isOverdue)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
        colorClass,
        className
      )}
    >
      <Clock className="h-2.5 w-2.5" />
      {timeText}
    </span>
  )
}
