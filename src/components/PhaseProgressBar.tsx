// PhaseProgressBar Component (Feature 3)
// Displays current phase in the theme progression

import { CheckCircle, Circle, Sparkles, Target, Trophy, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ThemePhase } from '@/types/musicLeague'
import { PHASE_THRESHOLDS } from '@/types/musicLeague'

interface PhaseProgressBarProps {
  currentPhase: ThemePhase
  candidateCount: number
  semifinalistCount: number
  finalistCount: number
  hasPick?: boolean  // Optional, not currently used but may be in future
  className?: string
  compact?: boolean
}

interface PhaseConfig {
  phase: ThemePhase
  label: string
  icon: React.ReactNode
  description: string
  target?: number
}

const PHASES: PhaseConfig[] = [
  {
    phase: 'brainstorm',
    label: 'Brainstorm',
    icon: <Lightbulb className="h-4 w-4" />,
    description: 'Collect candidates',
    target: PHASE_THRESHOLDS.refine.candidates,
  },
  {
    phase: 'refine',
    label: 'Refine',
    icon: <Sparkles className="h-4 w-4" />,
    description: 'Narrow to semifinalists',
    target: PHASE_THRESHOLDS.decide.semifinalists,
  },
  {
    phase: 'decide',
    label: 'Decide',
    icon: <Target className="h-4 w-4" />,
    description: 'Choose finalists',
    target: 4,
  },
  {
    phase: 'complete',
    label: 'Complete',
    icon: <Trophy className="h-4 w-4" />,
    description: 'Pick selected!',
  },
]

function getPhaseIndex(phase: ThemePhase): number {
  if (phase === 'idle') return -1
  const index = PHASES.findIndex(p => p.phase === phase)
  return index >= 0 ? index : 0
}

export function PhaseProgressBar({
  currentPhase,
  candidateCount,
  semifinalistCount,
  finalistCount,
  className,
  compact = false,
}: PhaseProgressBarProps): React.ReactElement {
  const currentIndex = getPhaseIndex(currentPhase)

  // Calculate progress within current phase
  const getProgress = (): { current: number; target: number } | null => {
    switch (currentPhase) {
      case 'brainstorm':
        return { current: candidateCount, target: PHASE_THRESHOLDS.refine.candidates }
      case 'refine':
        return { current: semifinalistCount, target: PHASE_THRESHOLDS.decide.semifinalists }
      case 'decide':
        return { current: finalistCount, target: 4 }
      case 'complete':
        return null
      default:
        return null
    }
  }

  const progress = getProgress()

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {PHASES.map((phase, index) => {
          const isComplete = index < currentIndex || currentPhase === 'complete'
          const isCurrent = index === currentIndex
          const isUpcoming = index > currentIndex

          return (
            <div
              key={phase.phase}
              className={cn(
                'flex items-center gap-1 text-xs',
                isComplete && 'text-green-500',
                isCurrent && 'text-primary font-medium',
                isUpcoming && 'text-muted-foreground'
              )}
            >
              {isComplete ? (
                <CheckCircle className="h-3 w-3" />
              ) : isCurrent ? (
                <div className="relative">
                  {phase.icon}
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
                </div>
              ) : (
                <Circle className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">{phase.label}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Phase Steps */}
      <div className="flex items-center justify-between">
        {PHASES.map((phase, index) => {
          const isComplete = index < currentIndex || currentPhase === 'complete'
          const isCurrent = index === currentIndex
          const isUpcoming = index > currentIndex

          return (
            <div key={phase.phase} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                  isComplete && 'border-green-500 bg-green-500 text-white',
                  isCurrent && 'border-primary bg-primary/10 text-primary',
                  isUpcoming && 'border-muted bg-muted/30 text-muted-foreground'
                )}
              >
                {isComplete ? <CheckCircle className="h-4 w-4" /> : phase.icon}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isComplete && 'text-green-500',
                  isCurrent && 'text-primary',
                  isUpcoming && 'text-muted-foreground'
                )}
              >
                {phase.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress Line */}
      <div className="relative h-1 bg-muted rounded-full">
        <div
          className="absolute h-full bg-primary rounded-full transition-all duration-500"
          style={{
            width: currentPhase === 'complete'
              ? '100%'
              : `${((currentIndex + 0.5) / PHASES.length) * 100}%`,
          }}
        />
      </div>

      {/* Current Phase Info */}
      {progress && currentPhase !== 'complete' && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{PHASES[currentIndex]?.description}</span>
          <span className="font-medium">
            {progress.current}/{progress.target}
          </span>
        </div>
      )}

      {currentPhase === 'complete' && (
        <div className="text-center text-xs text-green-500 font-medium">
          Your pick has been selected!
        </div>
      )}
    </div>
  )
}

// Simple badge showing current phase
export function PhaseBadge({
  phase,
  className,
}: {
  phase: ThemePhase
  className?: string
}): React.ReactElement {
  const config = PHASES.find(p => p.phase === phase)
  if (!config) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        Not started
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
        phase === 'complete' && 'bg-green-500/10 text-green-500',
        phase === 'decide' && 'bg-amber-500/10 text-amber-500',
        phase === 'refine' && 'bg-blue-500/10 text-blue-500',
        phase === 'brainstorm' && 'bg-purple-500/10 text-purple-500',
        className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  )
}
