import { useState, useEffect } from 'react'
import { Settings, Eye, EyeOff, ExternalLink, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useSettingsStore } from '@/stores/settingsStore'
import { useModelsStore } from '@/stores/modelsStore'
import { ModelsManager } from '@/components/ModelsManager'

interface SettingsModalProps {
  trigger?: React.ReactNode
}

export function SettingsModal({ trigger }: SettingsModalProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false)
  const [showSpotifySecret, setShowSpotifySecret] = useState(false)
  const [showYouTubeSecret, setShowYouTubeSecret] = useState(false)

  // Settings store
  const {
    openRouterKey,
    defaultModel,
    spotify,
    youtubeMusic,
    setOpenRouterKey,
    setDefaultModel,
    setSpotifyConfig,
    setYouTubeMusicConfig,
  } = useSettingsStore()

  // Models store
  const models = useModelsStore((s) => s.models)

  // Local state for form
  const [localOpenRouterKey, setLocalOpenRouterKey] = useState(openRouterKey)
  const [localDefaultModel, setLocalDefaultModel] = useState(defaultModel)
  const [localSpotify, setLocalSpotify] = useState(spotify)
  const [localYouTube, setLocalYouTube] = useState(youtubeMusic)

  // Sync local state with store when modal opens
  useEffect(() => {
    if (open) {
      setLocalOpenRouterKey(openRouterKey)
      setLocalDefaultModel(defaultModel)
      setLocalSpotify(spotify)
      setLocalYouTube(youtubeMusic)
    }
  }, [open, openRouterKey, defaultModel, spotify, youtubeMusic])

  const handleSave = (): void => {
    setOpenRouterKey(localOpenRouterKey)
    setDefaultModel(localDefaultModel)
    setSpotifyConfig(localSpotify)
    setYouTubeMusicConfig(localYouTube)
    setOpen(false)
  }

  const hasOpenRouterKey = !!localOpenRouterKey
  const hasSpotifyConfig = !!(localSpotify.clientId && localSpotify.clientSecret && localSpotify.refreshToken)
  const hasYouTubeConfig = !!(localYouTube.clientId && localYouTube.clientSecret && localYouTube.refreshToken)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure API keys and preferences for Music League Strategist.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 pb-6 space-y-6">
            {/* OpenRouter Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">OpenRouter API</h3>
                {hasOpenRouterKey ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3 w-3" />
                    Configured
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertCircle className="h-3 w-3" />
                    Required
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="openrouter-key" className="text-xs">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    id="openrouter-key"
                    type={showOpenRouterKey ? 'text' : 'password'}
                    value={localOpenRouterKey}
                    onChange={(e) => setLocalOpenRouterKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                  >
                    {showOpenRouterKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Get your API key <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-model" className="text-xs">
                  Default Model
                </Label>
                <Select
                  value={localDefaultModel}
                  onValueChange={setLocalDefaultModel}
                >
                  <SelectTrigger id="default-model">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.model_id}>
                        {model.nickname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Models Manager Section */}
            <ModelsManager />

            <Separator />

            {/* Spotify Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Spotify (Optional)</h3>
                {hasSpotifyConfig ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3 w-3" />
                    Configured
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    For playlist creation
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="spotify-client-id" className="text-xs">
                    Client ID
                  </Label>
                  <Input
                    id="spotify-client-id"
                    value={localSpotify.clientId}
                    onChange={(e) =>
                      setLocalSpotify({ ...localSpotify, clientId: e.target.value })
                    }
                    placeholder="Enter Spotify Client ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spotify-client-secret" className="text-xs">
                    Client Secret
                  </Label>
                  <div className="relative">
                    <Input
                      id="spotify-client-secret"
                      type={showSpotifySecret ? 'text' : 'password'}
                      value={localSpotify.clientSecret}
                      onChange={(e) =>
                        setLocalSpotify({ ...localSpotify, clientSecret: e.target.value })
                      }
                      placeholder="Enter Spotify Client Secret"
                      className="pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSpotifySecret(!showSpotifySecret)}
                    >
                      {showSpotifySecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spotify-refresh-token" className="text-xs">
                    Refresh Token
                  </Label>
                  <Input
                    id="spotify-refresh-token"
                    type="password"
                    value={localSpotify.refreshToken}
                    onChange={(e) =>
                      setLocalSpotify({ ...localSpotify, refreshToken: e.target.value })
                    }
                    placeholder="Enter Spotify Refresh Token"
                  />
                </div>

                <a
                  href="https://developer.spotify.com/documentation/web-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Spotify API Setup Guide <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <Separator />

            {/* YouTube Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">YouTube Music (Optional)</h3>
                {hasYouTubeConfig ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3 w-3" />
                    Configured
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    For playlist creation
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="youtube-client-id" className="text-xs">
                    Client ID
                  </Label>
                  <Input
                    id="youtube-client-id"
                    value={localYouTube.clientId}
                    onChange={(e) =>
                      setLocalYouTube({ ...localYouTube, clientId: e.target.value })
                    }
                    placeholder="Enter YouTube Client ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtube-client-secret" className="text-xs">
                    Client Secret
                  </Label>
                  <div className="relative">
                    <Input
                      id="youtube-client-secret"
                      type={showYouTubeSecret ? 'text' : 'password'}
                      value={localYouTube.clientSecret}
                      onChange={(e) =>
                        setLocalYouTube({ ...localYouTube, clientSecret: e.target.value })
                      }
                      placeholder="Enter YouTube Client Secret"
                      className="pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowYouTubeSecret(!showYouTubeSecret)}
                    >
                      {showYouTubeSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtube-refresh-token" className="text-xs">
                    Refresh Token
                  </Label>
                  <Input
                    id="youtube-refresh-token"
                    type="password"
                    value={localYouTube.refreshToken}
                    onChange={(e) =>
                      setLocalYouTube({ ...localYouTube, refreshToken: e.target.value })
                    }
                    placeholder="Enter YouTube Refresh Token"
                  />
                </div>

                <a
                  href="https://developers.google.com/youtube/v3/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  YouTube API Setup Guide <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
