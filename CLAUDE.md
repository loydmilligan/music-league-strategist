# CLAUDE.md — Music League Strategist

## Project Overview

Music League Strategist is a standalone web app for discovering and organizing song picks for Music League competitions. It uses AI to suggest songs based on themes, and a 4-tier funnel system to narrow down to a final pick.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Components | shadcn/ui (Radix primitives) |
| State | Zustand with localStorage persistence |
| AI | OpenRouter API |
| Music APIs | Spotify OAuth, YouTube Data API, Songlink |

## Architecture

```
src/
├── components/          # UI components
│   ├── ui/              # shadcn/ui primitives
│   ├── MusicLeagueStrategist.tsx  # Main chat + funnel UI
│   ├── FunnelVisualization.tsx    # 4-tier funnel display
│   ├── SongDetailSlideout.tsx     # Song details panel
│   ├── ThemeSelector.tsx          # Theme management
│   ├── SessionManager.tsx         # Session switching
│   ├── PlaylistSyncPanel.tsx      # Spotify sync controls
│   └── SettingsModal.tsx          # API key configuration
├── stores/
│   ├── musicLeagueStore.ts        # Main app state
│   └── settingsStore.ts           # Settings + API keys
├── services/
│   ├── openrouter.ts              # AI chat service
│   ├── spotify.ts                 # Spotify API + Songlink
│   └── youtubeMusic.ts            # YouTube Data API
├── types/
│   ├── musicLeague.ts             # All types + AI prompts
│   └── chat.ts                    # Chat message types
└── lib/
    └── utils.ts                   # cn() utility function
```

## Key Patterns

### State Management

Uses Zustand with localStorage persistence:

```typescript
const { themes, activeThemeId, createTheme } = useMusicLeagueStore()
const { openRouterKey, setOpenRouterKey } = useSettingsStore()
```

### AI Integration

Songs are discovered via structured JSON responses from OpenRouter:

```typescript
const response = await openRouterService.chat(messages, modelId, options)
const parsed = parseAIResponse(response) // Extracts JSON from response
```

### Song Enrichment

New songs are enriched with Spotify/YouTube IDs via Songlink:

```typescript
const enrichedSongs = await spotifyService.enrichSongsWithTrackIds(songs)
```

### Funnel System

Songs progress through tiers: `candidates` → `semifinalists` → `finalists` → `pick`

```typescript
promoteSong(themeId, song, 'finalists', 'reason')
demoteSong(themeId, song, 'candidates', 'reason')
```

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
```

## Docker Deployment

```bash
docker compose up -d --build    # Build and run
docker compose logs -f          # View logs
docker compose down             # Stop
```

App available at http://localhost:3000

## Configuration

### Environment Variables

```bash
VITE_OPENROUTER_API_KEY=        # Required - OpenRouter API key
VITE_DEFAULT_MODEL=             # Optional - Default AI model
VITE_SPOTIFY_CLIENT_ID=         # Optional - Spotify OAuth
VITE_SPOTIFY_CLIENT_SECRET=     # Optional
VITE_SPOTIFY_REFRESH_TOKEN=     # Optional
VITE_YOUTUBE_CLIENT_ID=         # Optional - YouTube OAuth
VITE_YOUTUBE_CLIENT_SECRET=     # Optional
VITE_YOUTUBE_REFRESH_TOKEN=     # Optional
```

Settings can also be configured via the Settings modal (gear icon) and are stored in localStorage.

## Key Files

| File | Purpose |
|------|---------|
| `src/stores/musicLeagueStore.ts` | Main app state (themes, sessions, songs) |
| `src/stores/settingsStore.ts` | API keys + model selection |
| `src/types/musicLeague.ts` | Types + AI system prompts |
| `src/components/MusicLeagueStrategist.tsx` | Main UI component |
| `docker-compose.yml` | Production deployment |
| `.github/workflows/deploy.yml` | CI/CD for Raspberry Pi |

## Deployment Target

- **Host**: dietpi@192.168.4.252
- **Path**: /home/dietpi/music-league-strategist
- **Port**: 3000 (via Docker)
- **CI/CD**: GitHub Actions with self-hosted runner
