# Music League Strategist - Major Feature Implementation Plan

## Overview

This plan covers 8 major feature additions to enhance the Music League Strategist workflow with better AI commands, deadline tracking, phase progression, notifications, persistent collections, and data import capabilities.

---

## Feature 1: Explicit "Add to Candidates" AI Command

**Goal**: Allow users to explicitly tell the AI to add songs to the candidate list via chat commands.

**Changes**:
- `src/types/musicLeague.ts`: Update `TierAction` type to include explicit `add_to_candidates` action
- `src/services/openrouter.ts`: Update system prompt to recognize commands like "add X to candidates"
- `src/components/MusicLeagueStrategist.tsx`: Handle `add_to_candidates` action in `handleSendMessage`

**Implementation**:
```typescript
// In TierAction type, add:
type TierAction = 'promote' | 'demote' | 'remove' | 'add_to_candidates'

// In AI response parsing, recognize:
{ action: 'add_to_candidates', song: {...} }
```

---

## Feature 2: Deadline UI for Theme Management

**Goal**: Add deadline date/time to themes with visual countdown indicators.

**Changes**:
- `src/types/musicLeague.ts`: Add `deadline?: string` (ISO date) to `Theme` type
- `src/stores/musicLeagueStore.ts`: Add `updateThemeDeadline` action
- `src/components/ThemeSelector.tsx`: Add deadline picker and countdown display
- New component: `src/components/DeadlineIndicator.tsx`

**UI Design**:
- Date/time picker in theme creation/edit modal
- Countdown badge showing "2d 5h left" or "Overdue!"
- Color coding: green (>24h), yellow (12-24h), orange (4-12h), red (<4h)

---

## Feature 3: Phase Progression System

**Goal**: Guide users through a structured progression from brainstorming to final pick.

**Phases**: `idle` → `brainstorm` → `refine` → `decide` → `complete`

**Milestones**:
| Phase | Trigger | Funnel State |
|-------|---------|--------------|
| brainstorm | Theme created | Collecting candidates (target: 30) |
| refine | 8+ candidates | Narrowing to semifinalists (target: 8) |
| decide | 4+ semifinalists | Choosing finalists (target: 4) |
| complete | 1 pick selected | Done |

**Changes**:
- `src/types/musicLeague.ts`: Add `phase: ThemePhase` to `Theme` type
- `src/stores/musicLeagueStore.ts`: Add `advancePhase`, auto-detect phase from funnel state
- `src/components/FunnelVisualization.tsx`: Show current phase with progress indicator
- New component: `src/components/PhaseProgressBar.tsx`

---

## Feature 4: Hall Pass System

**Goal**: Allow 2 late additions per theme (1 during semifinals, 1 during finals) for songs discovered after initial brainstorming.

**Changes**:
- `src/types/musicLeague.ts`: Add `hallPassesUsed: { semifinals: boolean, finals: boolean }` to `Theme`
- `src/stores/musicLeagueStore.ts`: Add `useHallPass` action
- `src/components/FunnelVisualization.tsx`: Show hall pass availability, button to use one

**Rules**:
- Semifinals hall pass: Add directly to semifinalists tier
- Finals hall pass: Add directly to finalists tier
- Visual indicator: "Hall Pass Available" badge

---

## Feature 5: ntfy Integration

**Goal**: Push notifications to phone for deadline reminders and phase milestones.

**Changes**:
- `src/stores/settingsStore.ts`: Add `ntfyTopic`, `ntfyEnabled` settings
- `src/components/SettingsModal.tsx`: Add ntfy configuration section
- New service: `src/services/ntfy.ts`

**Notification Triggers**:
| Event | Priority | Message |
|-------|----------|---------|
| 24h before deadline | default | "Theme X deadline in 24 hours" |
| 4h before deadline | high | "Theme X deadline in 4 hours!" |
| 1h before deadline | urgent | "URGENT: Theme X deadline in 1 hour!" |
| Phase milestone reached | default | "Theme X: Ready to refine (8 candidates)" |

**ntfy Service**:
```typescript
// src/services/ntfy.ts
export async function sendNotification(topic: string, title: string, message: string, priority?: string) {
  await fetch(`https://ntfy.sh/${topic}`, {
    method: 'POST',
    headers: { 'Title': title, 'Priority': priority || 'default' },
    body: message
  })
}
```

---

## Feature 6: "Songs I Like" Collection

**Goal**: Persistent collection of songs to save for future rounds.

**Changes**:
- `src/types/musicLeague.ts`: Add `SongsILikeCollection` type
- `src/stores/musicLeagueStore.ts`: Add `songsILike` state with CRUD actions
- New component: `src/components/SongsILikePanel.tsx`
- `src/components/SongDetailSlideout.tsx`: Add "Save for Later" button

**Features**:
- Add songs from any theme or search result
- Tag songs with potential themes/moods
- Quick-add to current theme's candidates
- Persists in localStorage like other state

---

## Feature 7: Competitor Analysis Playlist

**Goal**: Track top 3 songs each week from other competitors to understand what wins.

**Changes**:
- `src/types/musicLeague.ts`: Add `CompetitorAnalysis` types
- `src/stores/musicLeagueStore.ts`: Add `competitorAnalysis` state
- New component: `src/components/CompetitorAnalysisPanel.tsx`

**Data Model** (based on CSV format):
```typescript
interface CompetitorSubmission {
  spotifyUri: string
  title: string
  artist: string
  submitterId: string
  submitterName: string
  roundId: string
  roundName: string
  pointsReceived: number
  rank: number
}

interface CompetitorProfile {
  id: string
  name: string
  submissions: CompetitorSubmission[]
  averagePoints: number
  wins: number
}
```

---

## Feature 8: CSV Import

**Goal**: Import Music League data exports for competitor analysis.

**CSV Format** (from docs/):
- `rounds.csv`: ID, Created, Name, Description, Playlist URL
- `submissions.csv`: Spotify URI, Title, Album, Artist(s), Submitter ID, Created, Comment, Round ID
- `competitors.csv`: ID, Name
- `votes.csv`: Spotify URI, Voter ID, Created, Points Assigned, Comment, Round ID

**Changes**:
- New service: `src/services/csvImport.ts`
- New component: `src/components/CSVImportModal.tsx`
- `src/stores/musicLeagueStore.ts`: Add `importLeagueData` action

**Import Flow**:
1. User uploads 4 CSV files (or zip)
2. Parse and validate data
3. Aggregate votes per song per round
4. Calculate rankings (top 3 per round)
5. Build competitor profiles
6. Store in competitorAnalysis state

**Parser Logic**:
```typescript
// Aggregate points per song per round
const songPoints = votes.reduce((acc, vote) => {
  const key = `${vote.roundId}-${vote.spotifyUri}`
  acc[key] = (acc[key] || 0) + vote.pointsAssigned
  return acc
}, {})

// Rank songs within each round
// Extract top 3 per round for analysis
```

---

## Implementation Order

1. **Deadline UI** (Feature 2) - Foundation for notifications
2. **Phase Progression** (Feature 3) - Core workflow enhancement
3. **Hall Pass System** (Feature 4) - Depends on phase system
4. **Add to Candidates Command** (Feature 1) - Quick win
5. **ntfy Integration** (Feature 5) - Depends on deadlines
6. **Songs I Like Collection** (Feature 6) - Independent feature
7. **CSV Import** (Feature 8) - Data foundation for analysis
8. **Competitor Analysis** (Feature 7) - Depends on CSV import

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/musicLeague.ts` | Theme type updates, new collection types |
| `src/stores/musicLeagueStore.ts` | New state slices and actions |
| `src/stores/settingsStore.ts` | ntfy settings |
| `src/components/ThemeSelector.tsx` | Deadline picker |
| `src/components/FunnelVisualization.tsx` | Phase progress, hall passes |
| `src/components/MusicLeagueStrategist.tsx` | Add to candidates handling |
| `src/components/SongDetailSlideout.tsx` | Save for later button |
| `src/components/SettingsModal.tsx` | ntfy config section |

## New Files to Create

| File | Purpose |
|------|---------|
| `src/services/ntfy.ts` | Push notification service |
| `src/services/csvImport.ts` | CSV parsing and aggregation |
| `src/components/DeadlineIndicator.tsx` | Countdown display |
| `src/components/PhaseProgressBar.tsx` | Phase visualization |
| `src/components/SongsILikePanel.tsx` | Persistent collection UI |
| `src/components/CompetitorAnalysisPanel.tsx` | Competitor stats |
| `src/components/CSVImportModal.tsx` | Import wizard |

---

## Verification

1. **Deadline UI**: Create theme with deadline, verify countdown displays correctly
2. **Phase Progression**: Add songs, verify phase auto-advances at thresholds
3. **Hall Pass**: In refine phase, use hall pass to add song directly to semifinalists
4. **AI Command**: Chat "add [song name] to candidates", verify song appears
5. **ntfy**: Configure topic in settings, trigger deadline warning, verify push received
6. **Songs I Like**: Save song from slideout, verify persists after refresh
7. **CSV Import**: Import sample CSV files from docs/, verify competitor profiles populate
8. **Competitor Analysis**: View imported data, see top 3 songs per round
