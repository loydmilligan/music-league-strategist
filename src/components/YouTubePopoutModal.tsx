import { useState, useCallback, useRef, useEffect } from 'react'
import { Clock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface YouTubePopoutModalProps {
  videoId: string
  songTitle: string
  songArtist: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onNotesSubmit: (notes: string) => void
  existingNotes?: string
}

// Format seconds to MM:SS
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function YouTubePopoutModal({
  videoId,
  songTitle,
  songArtist,
  open,
  onOpenChange,
  onNotesSubmit,
  existingNotes = '',
}: YouTubePopoutModalProps): React.ReactElement {
  const [sessionNotes, setSessionNotes] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const playerRef = useRef<YT.Player | null>(null)
  const [playerReady, setPlayerReady] = useState(false)

  // Initialize YouTube IFrame API
  useEffect(() => {
    if (!open || !videoId) return

    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

      window.onYouTubeIframeAPIReady = () => {
        initializePlayer()
      }
    } else if (window.YT.Player) {
      initializePlayer()
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      setPlayerReady(false)
    }
  }, [open, videoId])

  const initializePlayer = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.destroy()
    }

    playerRef.current = new window.YT.Player(`youtube-player-${videoId}`, {
      videoId,
      playerVars: {
        autoplay: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          setPlayerReady(true)
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          // Update current time when playing
          if (event.data === window.YT.PlayerState.PLAYING) {
            const updateTime = () => {
              if (playerRef.current && playerRef.current.getCurrentTime) {
                setCurrentTime(playerRef.current.getCurrentTime())
              }
            }
            // Update time every second while playing
            const interval = setInterval(() => {
              if (playerRef.current?.getPlayerState?.() === window.YT.PlayerState.PLAYING) {
                updateTime()
              } else {
                clearInterval(interval)
              }
            }, 1000)
          }
        },
      },
    })
  }, [videoId])

  // Insert timestamp into notes
  const handleInsertTimestamp = useCallback(() => {
    if (playerRef.current && playerRef.current.getCurrentTime) {
      const time = playerRef.current.getCurrentTime()
      const timestamp = formatTimestamp(time)
      const timestampText = `[${timestamp}] `
      setSessionNotes((prev) => prev + (prev ? '\n' : '') + timestampText)
    }
  }, [])

  // Handle close - merge notes
  const handleClose = useCallback(() => {
    if (sessionNotes.trim()) {
      onNotesSubmit(sessionNotes.trim())
    }
    setSessionNotes('')
    onOpenChange(false)
  }, [sessionNotes, onNotesSubmit, onOpenChange])

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{songTitle}</p>
              <p className="text-sm text-muted-foreground truncate">{songArtist}</p>
            </div>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 p-2 hover:bg-accent rounded"
              title="Open in YouTube"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* YouTube Player */}
          <div className="aspect-video w-full rounded overflow-hidden bg-black">
            <div id={`youtube-player-${videoId}`} className="w-full h-full" />
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Session Notes</span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleInsertTimestamp}
                disabled={!playerReady}
                title={playerReady ? `Insert timestamp (${formatTimestamp(currentTime)})` : 'Player loading...'}
              >
                <Clock className="h-3.5 w-3.5" />
                {formatTimestamp(currentTime)}
              </Button>
            </div>
            <Textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Add timestamped notes while listening... Click the timestamp button to mark moments."
              className="min-h-[120px] text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Notes will be appended to the song's notes when you close this window.
            </p>
          </div>

          {/* Show existing notes if any */}
          {existingNotes && (
            <div className="space-y-2 pt-2 border-t">
              <span className="text-xs font-medium text-muted-foreground">Existing Notes</span>
              <div className="p-2 rounded bg-muted/30 text-sm whitespace-pre-wrap max-h-[100px] overflow-auto">
                {existingNotes}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleClose}>
            Save Notes & Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Add YouTube IFrame API types
declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }

  namespace YT {
    class Player {
      constructor(elementId: string, options: PlayerOptions)
      destroy(): void
      getCurrentTime(): number
      getPlayerState(): number
    }

    interface PlayerOptions {
      videoId: string
      playerVars?: {
        autoplay?: number
        modestbranding?: number
        rel?: number
      }
      events?: {
        onReady?: () => void
        onStateChange?: (event: OnStateChangeEvent) => void
      }
    }

    interface OnStateChangeEvent {
      data: number
    }

    const PlayerState: {
      PLAYING: number
      PAUSED: number
      ENDED: number
    }
  }
}
