import { Music2, Settings, Loader2, RefreshCw, Database, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MusicLeagueStrategist } from '@/components/MusicLeagueStrategist'
import { SettingsModal } from '@/components/SettingsModal'
import { SongsILikeButton } from '@/components/SongsILikePanel'
import { CompetitorAnalysisPanel } from '@/components/CompetitorAnalysisPanel'
import { HelpModal } from '@/components/HelpModal'
import { useSettingsStore } from '@/stores/settingsStore'
import { useServerSync } from '@/hooks/useServerSync'

function App(): React.ReactElement {
  console.log('[App] render start')
  const openRouterKey = useSettingsStore((s) => s.openRouterKey)
  const hasApiKey = !!openRouterKey
  console.log('[App] hasApiKey:', hasApiKey)

  const {
    isLoading,
    error,
    migrationNeeded,
    isMigrating,
    migrateToServer,
    skipMigration,
    retry,
  } = useServerSync()
  console.log('[App] useServerSync:', { isLoading, error, migrationNeeded })

  // Show loading state
  if (isLoading) {
    console.log('[App] returning loading state')
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show migration prompt
  if (migrationNeeded) {
    console.log('[App] returning migration prompt')
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground p-8">
        <div className="max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Migrate to Server Database</h2>
          <p className="text-muted-foreground">
            We found existing data in your browser. Would you like to migrate it to the server database?
            This will enable access from any device.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={migrateToServer}
              disabled={isMigrating}
              className="gap-2"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  Migrate Data to Server
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={skipMigration}
              disabled={isMigrating}
              className="gap-2"
            >
              <HardDrive className="h-4 w-4" />
              Start Fresh (Keep Browser Data)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: If you skip migration, your browser data will remain but won't be synced to the server.
          </p>
        </div>
      </div>
    )
  }

  console.log('[App] returning main render')
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Minimal Header */}
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Music2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold">Music League Strategist</span>
        </div>
        <div className="flex items-center gap-1">
          <HelpModal />
          <SongsILikeButton />
          <CompetitorAnalysisPanel />
          <SettingsModal
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </header>

      {/* Server sync error banner */}
      {error && (
        <div className="flex items-center justify-between border-b bg-yellow-500/10 px-4 py-2 text-sm">
          <span className="text-yellow-700 dark:text-yellow-300">{error}</span>
          <Button variant="ghost" size="sm" onClick={retry} className="h-6 gap-1">
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {!hasApiKey ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-md space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Music2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Welcome to Music League Strategist</h2>
              <p className="text-muted-foreground">
                Get AI-powered song recommendations for your Music League themes.
                Configure your OpenRouter API key to get started.
              </p>
              <SettingsModal
                trigger={
                  <Button size="lg" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Configure API Key
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <MusicLeagueStrategist />
        )}
      </main>
    </div>
  )
}

export default App
