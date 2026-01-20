import {
  Music2,
  ChevronDown,
  Settings,
  Clock,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { SettingsModal } from '@/components/SettingsModal'

interface MobileHeaderProps {
  title?: string
  subtitle?: string
  showThemeSelector?: boolean
  rightAction?: React.ReactNode
}

export function MobileHeader({
  title,
  subtitle,
  showThemeSelector = true,
  rightAction
}: MobileHeaderProps): React.ReactElement {
  const {
    themes,
    activeThemeId,
    activeTheme,
    setActiveTheme
  } = useMusicLeagueStore()
  const theme = activeTheme()
  const activeThemes = themes.filter((t) => t.status === 'active')

  // Deadline display
  const deadlineDisplay = theme?.deadline ? (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>
        {Math.ceil((theme.deadline - Date.now()) / (1000 * 60 * 60 * 24))}d
      </span>
    </div>
  ) : null

  return (
    <header className="glass sticky top-0 z-40 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Logo and Theme Selector */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Logo */}
          <div className={cn(
            'flex-shrink-0',
            'flex h-10 w-10 items-center justify-center',
            'rounded-xl bg-primary shadow-glow'
          )}>
            <Music2 className="h-5 w-5 text-primary-foreground" />
          </div>

          {/* Theme Selector */}
          {showThemeSelector ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex-1 min-w-0 flex items-center gap-2 text-left">
                  <div className="min-w-0 flex-1">
                    <h1 className="font-display text-sm truncate">
                      {theme?.title || title || 'ML Strategist'}
                    </h1>
                    <div className="flex items-center gap-2">
                      {subtitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          {subtitle}
                        </span>
                      )}
                      {deadlineDisplay}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {activeThemes.length > 0 ? (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Active Themes
                    </div>
                    {activeThemes.map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => setActiveTheme(t.id)}
                        className="flex items-center gap-2"
                      >
                        {t.id === activeThemeId && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                        <span className={cn(
                          'truncate',
                          t.id !== activeThemeId && 'ml-6'
                        )}>
                          {t.title}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem
                  onClick={() => {
                    // Will be handled by parent
                  }}
                >
                  <span className="text-primary">+ New Theme</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-sm truncate">
                {title || 'ML Strategist'}
              </h1>
              {subtitle && (
                <span className="text-xs text-muted-foreground truncate">
                  {subtitle}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {rightAction}
          <SettingsModal
            trigger={
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <Settings className="h-5 w-5" />
              </Button>
            }
          />
        </div>
      </div>
    </header>
  )
}
