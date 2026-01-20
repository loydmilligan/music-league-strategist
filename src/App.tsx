import { useEffect, useState, useCallback } from 'react'
import { Music2, Loader2, RefreshCw, Database, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { initializeStoreSync } from '@/stores/storeSync'
import { useSettingsStore } from '@/stores/settingsStore'
import { useServerSync } from '@/hooks/useServerSync'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import type { Song } from '@/types/musicLeague'
import {
  BottomNav,
  MobileHeader,
  ChatView,
  FunnelView,
  PlayerView,
  ProfileView,
  type MobileView
} from '@/components/mobile'
import { SongDetailSlideout } from '@/components/SongDetailSlideout'
import { SettingsModal } from '@/components/SettingsModal'

function App(): React.ReactElement {
  const [activeView, setActiveView] = useState<MobileView>('chat')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [slideoutOpen, setSlideoutOpen] = useState(false)

  const openRouterKey = useSettingsStore((s) => s.openRouterKey)
  const hasApiKey = !!openRouterKey

  const { activeTheme, createTheme, setActiveTheme } = useMusicLeagueStore()
  const theme = activeTheme()

  // Initialize store sync on mount
  useEffect(() => {
    const unsubscribe = initializeStoreSync()
    return () => unsubscribe()
  }, [])

  const {
    isLoading,
    error,
    migrationNeeded,
    isMigrating,
    migrateToServer,
    skipMigration,
    retry,
  } = useServerSync()

  // Handle song selection from any view
  const handleSongSelect = useCallback((song: Song) => {
    setSelectedSong(song)
    setSlideoutOpen(true)
  }, [])

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    const themeId = createTheme('New Theme')
    setActiveTheme(themeId)
    setActiveView('chat')
  }, [createTheme, setActiveTheme])

  // Switch to funnel view
  const handleSwitchToFunnel = useCallback(() => {
    setActiveView('funnel')
  }, [])

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen-dynamic flex-col items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse-glow">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show migration prompt
  if (migrationNeeded) {
    return (
      <div className="flex h-screen-dynamic flex-col items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-sm space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Database className="h-10 w-10 text-primary" />
          </div>
          <h2 className="font-display text-2xl">Sync Your Data</h2>
          <p className="text-muted-foreground text-sm">
            We found existing data in your browser. Would you like to migrate it to the server?
            This enables access from any device.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={migrateToServer}
              disabled={isMigrating}
              className="h-14 gap-2 glow-primary"
              size="lg"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <Database className="h-5 w-5" />
                  Migrate to Server
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={skipMigration}
              disabled={isMigrating}
              className="h-14 gap-2"
              size="lg"
            >
              <HardDrive className="h-5 w-5" />
              Start Fresh
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: If you skip, your browser data will remain but won't sync to the server.
          </p>
        </div>
      </div>
    )
  }

  // Show onboarding for new users without API key
  if (!hasApiKey) {
    return (
      <div className="flex h-screen-dynamic flex-col items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-sm space-y-6 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-glow-lg">
            <Music2 className="h-12 w-12 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl">ML Strategist</h1>
          <p className="text-muted-foreground">
            AI-powered song discovery for Music League competitions.
            Configure your API key to get started.
          </p>
          <SettingsModal
            trigger={
              <Button size="lg" className="h-14 gap-2 w-full glow-primary">
                Get Started
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  // Get view-specific header props
  const getHeaderProps = () => {
    switch (activeView) {
      case 'chat':
        return {
          showThemeSelector: true,
          subtitle: theme ? `${theme.candidates?.length || 0} candidates` : undefined
        }
      case 'funnel':
        return {
          showThemeSelector: true,
          subtitle: 'Funnel View'
        }
      case 'player':
        return {
          title: 'Now Playing',
          showThemeSelector: false
        }
      case 'profile':
        return {
          title: 'Profile',
          showThemeSelector: false
        }
      default:
        return {}
    }
  }

  return (
    <div className="flex h-screen-dynamic flex-col bg-background text-foreground">
      {/* Mobile Header */}
      <MobileHeader {...getHeaderProps()} />

      {/* Server sync error banner */}
      {error && (
        <div className="flex items-center justify-between bg-warning/10 px-4 py-2 text-sm">
          <span className="text-warning">{error}</span>
          <Button variant="ghost" size="sm" onClick={retry} className="h-7 gap-1">
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden pb-20">
        {activeView === 'chat' && (
          <ChatView
            onSongSelect={handleSongSelect}
            onSwitchToFunnel={handleSwitchToFunnel}
          />
        )}
        {activeView === 'funnel' && (
          <FunnelView onSongSelect={handleSongSelect} />
        )}
        {activeView === 'player' && (
          <PlayerView initialSong={selectedSong} />
        )}
        {activeView === 'profile' && <ProfileView />}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeView={activeView}
        onViewChange={setActiveView}
        onNewConversation={handleNewConversation}
      />

      {/* Song Detail Slideout */}
      <SongDetailSlideout
        song={selectedSong}
        themeId={theme?.id || null}
        open={slideoutOpen}
        onOpenChange={setSlideoutOpen}
      />
    </div>
  )
}

export default App
