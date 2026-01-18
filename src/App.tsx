import { Music2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MusicLeagueStrategist } from '@/components/MusicLeagueStrategist'
import { SettingsModal } from '@/components/SettingsModal'
import { SongsILikeButton } from '@/components/SongsILikePanel'
import { CompetitorAnalysisPanel } from '@/components/CompetitorAnalysisPanel'
import { useSettingsStore } from '@/stores/settingsStore'

function App(): React.ReactElement {
  const openRouterKey = useSettingsStore((s) => s.openRouterKey)
  const hasApiKey = !!openRouterKey

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
