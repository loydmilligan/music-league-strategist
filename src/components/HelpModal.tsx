// Help Modal - Explains the workflow and available actions

import { HelpCircle, ChevronUp, ChevronDown, VolumeX, X, Star, Ticket, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface HelpModalProps {
  trigger?: React.ReactNode
}

export function HelpModal({ trigger }: HelpModalProps): React.ReactElement {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Help">
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            How Music League Strategist Works
          </DialogTitle>
          <DialogDescription>
            A guide to the workflow, phases, and actions available.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-6 pb-6">
          <div className="space-y-6">
            {/* Workflow Overview */}
            <section>
              <h3 className="font-semibold text-sm mb-2">The Funnel Workflow</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Songs progress through a 4-tier funnel as you narrow down to your final pick:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 p-2 rounded border bg-amber-500/10 border-amber-500/30">
                  <span className="font-bold text-amber-500">PICK</span>
                  <span className="text-muted-foreground">→ 1 song - Your final submission</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded border bg-purple-500/10 border-purple-500/30">
                  <span className="font-bold text-purple-500">Finalists</span>
                  <span className="text-muted-foreground">→ Up to 4 - Top contenders</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded border bg-blue-500/10 border-blue-500/30">
                  <span className="font-bold text-blue-500">Semifinalists</span>
                  <span className="text-muted-foreground">→ Up to 8 - Strong candidates</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded border bg-muted/50">
                  <span className="font-bold text-muted-foreground">Candidates</span>
                  <span className="text-muted-foreground">→ Up to 30 - Discovery pool</span>
                </div>
              </div>
            </section>

            <Separator />

            {/* Phases */}
            <section>
              <h3 className="font-semibold text-sm mb-2">Phases</h3>
              <p className="text-sm text-muted-foreground mb-3">
                The phase auto-advances based on your funnel state:
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Brainstorm</span>
                  <span className="text-muted-foreground">Theme created, collecting candidates</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Refine</span>
                  <span className="text-muted-foreground">8+ candidates → narrow to semifinals</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Decide</span>
                  <span className="text-muted-foreground">4+ semifinalists → choose finalists</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Complete</span>
                  <span className="text-muted-foreground">Pick selected!</span>
                </div>
              </div>
            </section>

            <Separator />

            {/* Actions */}
            <section>
              <h3 className="font-semibold text-sm mb-2">Song Actions</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded border">
                    <ChevronUp className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">Promote</p>
                    <p className="text-xs text-muted-foreground">Move song up to next tier</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded border">
                    <ChevronDown className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium">Demote</p>
                    <p className="text-xs text-muted-foreground">Move song down to previous tier</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded border">
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Mute</p>
                    <p className="text-xs text-muted-foreground">Keep in funnel but exclude from playlists. Good for "maybe" songs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded border">
                    <X className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium">Remove</p>
                    <p className="text-xs text-muted-foreground">Delete song from funnel entirely</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded border">
                    <Star className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium">Ratings</p>
                    <p className="text-xs text-muted-foreground">Rate theme fit and general quality (1-5 stars) in song details</p>
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Special Features */}
            <section>
              <h3 className="font-semibold text-sm mb-2">Special Features</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded border">
                    <Ticket className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium">Hall Passes</p>
                    <p className="text-xs text-muted-foreground">
                      2 per theme: add late discoveries directly to semifinals or finals (1 each)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded border">
                    <Clock className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Deadlines</p>
                    <p className="text-xs text-muted-foreground">
                      Set submission deadlines with countdown indicators and optional push notifications
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* AI Chat Tips */}
            <section>
              <h3 className="font-semibold text-sm mb-2">AI Chat Tips</h3>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>Paste your Music League theme to get AI song suggestions</li>
                <li>Tell the AI what you like/dislike about suggestions to refine results</li>
                <li>Say "add [song] to candidates" to explicitly add a song</li>
                <li>Say "make this a Spotify playlist" to export for listening</li>
                <li>Say "I'm going with [song]" to finalize your pick</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
