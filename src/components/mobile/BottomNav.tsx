import { useState } from 'react'
import {
  MessageSquare,
  Filter,
  Music,
  User,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

export type MobileView = 'chat' | 'funnel' | 'player' | 'profile'

interface BottomNavProps {
  activeView: MobileView
  onViewChange: (view: MobileView) => void
  onNewConversation?: () => void
}

export function BottomNav({
  activeView,
  onViewChange,
  onNewConversation
}: BottomNavProps): React.ReactElement {
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const { activeTheme, themes } = useMusicLeagueStore()
  const theme = activeTheme()

  // Calculate funnel progress for badge
  const totalSongs = theme
    ? (theme.pick ? 1 : 0) +
      (theme.finalists?.length || 0) +
      (theme.semifinalists?.length || 0) +
      (theme.candidates?.length || 0)
    : 0

  const navItems: Array<{
    id: MobileView
    icon: typeof MessageSquare
    label: string
    badge?: number | string
  }> = [
    {
      id: 'chat',
      icon: MessageSquare,
      label: 'Chat'
    },
    {
      id: 'funnel',
      icon: Filter,
      label: 'Funnel',
      badge: totalSongs > 0 ? totalSongs : undefined
    },
    {
      id: 'player',
      icon: Music,
      label: 'Player'
    },
    {
      id: 'profile',
      icon: User,
      label: 'Profile'
    },
  ]

  return (
    <>
      {/* Floating Action Button for new conversation - hidden on chat view to avoid overlapping submit button */}
      {activeView !== 'chat' && (
        <Sheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
          <SheetTrigger asChild>
            <button className="fab glow-primary">
              <Plus className="h-6 w-6" />
            </button>
          </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted" />
          <div className="py-6 space-y-3">
            <h3 className="font-display text-lg mb-4">Quick Actions</h3>
            <Button
              variant="outline"
              className="w-full justify-start h-14 text-base"
              onClick={() => {
                onNewConversation?.()
                setQuickActionsOpen(false)
              }}
            >
              <Plus className="mr-3 h-5 w-5" />
              New Theme
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-14 text-base"
              onClick={() => {
                onViewChange('chat')
                setQuickActionsOpen(false)
              }}
            >
              <MessageSquare className="mr-3 h-5 w-5" />
              Continue Chat
            </Button>
            {themes.length > 0 && (
              <Button
                variant="outline"
                className="w-full justify-start h-14 text-base"
                onClick={() => {
                  onViewChange('funnel')
                  setQuickActionsOpen(false)
                }}
              >
                <Filter className="mr-3 h-5 w-5" />
                View Funnel ({totalSongs} songs)
              </Button>
            )}
          </div>
        </SheetContent>
        </Sheet>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id

            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center',
                  'min-h-touch min-w-touch relative',
                  'transition-all duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'relative flex items-center justify-center',
                  'w-10 h-10 rounded-xl',
                  'transition-all duration-200',
                  isActive && 'bg-primary/10'
                )}>
                  <Icon className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    isActive && 'scale-110'
                  )} />

                  {/* Badge */}
                  {item.badge !== undefined && (
                    <span className={cn(
                      'absolute -top-1 -right-1',
                      'min-w-[18px] h-[18px] px-1',
                      'flex items-center justify-center',
                      'text-[10px] font-bold',
                      'rounded-full',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground text-background'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </div>

                <span className={cn(
                  'text-[10px] font-medium mt-0.5',
                  'transition-opacity duration-200',
                  isActive ? 'opacity-100' : 'opacity-70'
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
