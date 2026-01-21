import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Heart,
  Target,
  BarChart3,
  Settings,
  ChevronRight,
  Music2,
  Calendar,
  Trophy,
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { useAuthStore } from '@/stores/authStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SongsILikePanel } from '@/components/SongsILikePanel'
import { CompetitorAnalysisPanel } from '@/components/CompetitorAnalysisPanel'
import { SettingsModal } from '@/components/SettingsModal'
import { HelpModal } from '@/components/HelpModal'

export function ProfileView(): React.ReactElement {
  const navigate = useNavigate()
  const [likedSongsOpen, setLikedSongsOpen] = useState(false)
  const [competitorOpen, setCompetitorOpen] = useState(false)

  const { user, logout } = useAuthStore()
  const {
    themes,
    songsILike,
    userProfile,
    competitorAnalysis,
  } = useMusicLeagueStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Stats calculations
  const activeThemes = themes.filter(t => t.status === 'active').length
  const completedThemes = themes.filter(t => t.status === 'submitted').length
  const totalSongsDiscovered = themes.reduce((acc, t) => {
    return acc +
      (t.pick ? 1 : 0) +
      (t.finalists?.length || 0) +
      (t.semifinalists?.length || 0) +
      (t.candidates?.length || 0)
  }, 0)

  const preferenceCount = userProfile?.longTermPreferences?.length || 0

  const stats = [
    {
      label: 'Active Themes',
      value: activeThemes,
      icon: Target,
      color: 'text-primary'
    },
    {
      label: 'Completed',
      value: completedThemes,
      icon: Trophy,
      color: 'text-success'
    },
    {
      label: 'Songs Saved',
      value: songsILike.length,
      icon: Heart,
      color: 'text-destructive'
    },
    {
      label: 'Discovered',
      value: totalSongsDiscovered,
      icon: Music2,
      color: 'text-accent'
    }
  ]

  const menuItems = [
    {
      id: 'liked',
      label: 'Liked Songs',
      description: `${songsILike.length} songs saved`,
      icon: Heart,
      color: 'text-destructive',
      onClick: () => setLikedSongsOpen(true)
    },
    {
      id: 'competitors',
      label: 'Competitor Analysis',
      description: competitorAnalysis ? 'Data imported' : 'Import CSV data',
      icon: BarChart3,
      color: 'text-primary',
      onClick: () => setCompetitorOpen(true)
    },
    {
      id: 'preferences',
      label: 'Music Preferences',
      description: `${preferenceCount} learned preferences`,
      icon: User,
      color: 'text-accent',
      sheet: true
    },
    {
      id: 'themes',
      label: 'Theme History',
      description: `${themes.length} total themes`,
      icon: Calendar,
      color: 'text-muted-foreground',
      sheet: true
    }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-6 bg-gradient-to-b from-primary/10 to-transparent">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl">Your Profile</h2>
            <p className="text-sm text-muted-foreground truncate">
              {user?.email || 'Music League Strategist'}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mt-6">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="text-center p-3 rounded-xl bg-card/50"
              >
                <Icon className={cn('h-5 w-5 mx-auto mb-1', stat.color)} />
                <p className="font-display text-lg">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Menu Items */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-xl',
                  'bg-card border border-border/50',
                  'transition-all duration-200',
                  'active:scale-[0.98] active:bg-muted/50'
                )}
              >
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center',
                  'bg-muted'
                )}>
                  <Icon className={cn('h-5 w-5', item.color)} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            )
          })}

          {/* Settings */}
          <div className="pt-4 border-t mt-4">
            <SettingsModal
              trigger={
                <button className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-xl',
                  'bg-card border border-border/50',
                  'transition-all duration-200',
                  'active:scale-[0.98] active:bg-muted/50'
                )}>
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">Settings</p>
                    <p className="text-xs text-muted-foreground">API keys, models, integrations</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              }
            />

            <HelpModal
              trigger={
                <button className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-xl mt-2',
                  'bg-card border border-border/50',
                  'transition-all duration-200',
                  'active:scale-[0.98] active:bg-muted/50'
                )}>
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <Music2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">Help & About</p>
                    <p className="text-xs text-muted-foreground">How to use the app</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              }
            />

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl mt-2',
                'bg-card border border-destructive/20',
                'transition-all duration-200',
                'active:scale-[0.98] active:bg-destructive/10'
              )}
            >
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <LogOut className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-destructive">Sign Out</p>
                <p className="text-xs text-muted-foreground">Log out of your account</p>
              </div>
            </button>
          </div>
        </div>
      </ScrollArea>

      {/* Liked Songs Sheet */}
      <Sheet open={likedSongsOpen} onOpenChange={setLikedSongsOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted" />
          <SheetTitle className="sr-only">Liked Songs</SheetTitle>
          <SongsILikePanel />
        </SheetContent>
      </Sheet>

      {/* Competitor Analysis Sheet */}
      <Sheet open={competitorOpen} onOpenChange={setCompetitorOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted" />
          <SheetTitle className="sr-only">Competitor Analysis</SheetTitle>
          <CompetitorAnalysisPanel />
        </SheetContent>
      </Sheet>
    </div>
  )
}
