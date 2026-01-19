import { Cloud, CloudOff, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSyncStatus, forceSyncAll } from '@/stores/storeSync'
import { useState } from 'react'

export function SyncStatusButton(): React.ReactElement {
  const { isSyncing, lastSyncTime, syncError, pendingChanges } = useSyncStatus()
  const [showSuccess, setShowSuccess] = useState(false)

  const handleForceSync = async () => {
    try {
      await forceSyncAll()
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } catch {
      // Error is already handled in forceSyncAll
    }
  }

  // Determine icon and status
  let icon: React.ReactNode
  let statusText: string
  let statusColor: string

  if (isSyncing) {
    icon = <Loader2 className="h-4 w-4 animate-spin" />
    statusText = 'Syncing...'
    statusColor = 'text-blue-500'
  } else if (showSuccess) {
    icon = <Check className="h-4 w-4" />
    statusText = 'Saved!'
    statusColor = 'text-green-500'
  } else if (syncError) {
    icon = <AlertCircle className="h-4 w-4" />
    statusText = `Sync error: ${syncError}`
    statusColor = 'text-red-500'
  } else if (pendingChanges) {
    icon = <CloudOff className="h-4 w-4" />
    statusText = 'Unsaved changes'
    statusColor = 'text-yellow-500'
  } else {
    icon = <Cloud className="h-4 w-4" />
    statusText = lastSyncTime
      ? `Saved ${formatTime(lastSyncTime)}`
      : 'All changes saved'
    statusColor = 'text-green-500'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 min-w-[44px] min-h-[44px] ${statusColor}`}
            onClick={handleForceSync}
            disabled={isSyncing}
            aria-label={statusText}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{statusText}</p>
          {!isSyncing && <p className="text-xs text-muted-foreground">Click to force save</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function formatTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)

  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffMin < 60) return `${diffMin}m ago`

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
