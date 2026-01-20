import { useState } from 'react'
import { Plus, Sparkles, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { cn } from '@/lib/utils'

interface NewConversationButtonProps {
  className?: string
}

export function NewConversationButton({ className }: NewConversationButtonProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [selectedThemeId, setSelectedThemeId] = useState<string>('')

  const {
    themes,
    activeThemeId,
    createTheme,
    createSessionForTheme,
    setActiveTheme,
  } = useMusicLeagueStore()

  const activeThemes = themes.filter((t) => t.status === 'active')

  const handleNewTheme = (): void => {
    // Create a new theme - user will type the theme in the chat
    const id = createTheme('New Theme')
    setActiveTheme(id)
    setOpen(false)
  }

  const handleExistingTheme = (): void => {
    const themeId = selectedThemeId || activeThemeId
    if (themeId) {
      // Set the theme active first
      setActiveTheme(themeId)
      // Create a new session for this theme
      createSessionForTheme(themeId)
      setOpen(false)
      setSelectedThemeId('')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn('h-8 w-8', className)}
          title="New Conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          <div className="text-sm font-medium">Start New Conversation</div>

          {/* Option 1: New Theme */}
          <button
            onClick={handleNewTheme}
            className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">New Theme</div>
              <div className="text-xs text-muted-foreground">
                Start fresh with a new Music League theme
              </div>
            </div>
          </button>

          {/* Option 2: Existing Theme */}
          <div className="p-3 rounded-lg border space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary flex-shrink-0">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Existing Theme</div>
                <div className="text-xs text-muted-foreground">
                  Continue with same funnel, new chat
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Select
                value={selectedThemeId || activeThemeId || ''}
                onValueChange={setSelectedThemeId}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue placeholder="Select theme..." />
                </SelectTrigger>
                <SelectContent>
                  {activeThemes.length > 0 ? (
                    activeThemes.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        <span className="truncate">{theme.title}</span>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      No active themes
                    </div>
                  )}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                className="h-8"
                onClick={handleExistingTheme}
                disabled={!selectedThemeId && !activeThemeId}
              >
                Start
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
