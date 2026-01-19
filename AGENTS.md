# AGENTS.md — Music League Strategist

## Development Commands

### Build & Development
```bash
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build (TypeScript + Vite)
npm run preview      # Preview production build
```

### Code Quality
```bash
npm run lint         # Run ESLint on all files
```

### Testing
This project does not currently have automated tests. When implementing tests, check for test configuration files first.

## Code Style Guidelines

### Import Organization
- **External libraries** first (React, Radix, etc.)
- **Internal modules** second (using `@/` alias)
- **Relative imports** last
- **Type imports** use `import type` when possible

```typescript
// External libraries
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Type imports
import type { Song, Theme } from '@/types/musicLeague'
```

### TypeScript Patterns
- **Use strict typing** - no `any` unless absolutely necessary
- **Prefer interfaces** for object shapes, types for unions/primitives
- **Export types** from dedicated type files
- **Use generics** appropriately for reusable components

```typescript
interface Song {
  id: string
  title: string
  artist: string
}

export type FunnelTier = 'candidates' | 'semifinalists' | 'finalists' | 'pick'
```

### Component Patterns
- **Use function components** with hooks (no class components)
- **Destructure props** in function signature
- **Use cn() utility** for conditional styling
- **Forward refs** when needed for DOM manipulation

```typescript
interface SongListProps {
  songs: Song[]
  onSongSelect: (song: Song) => void
  className?: string
}

export function SongList({ songs, onSongSelect, className }: SongListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {songs.map(song => (
        <SongItem key={song.id} song={song} onSelect={onSongSelect} />
      ))}
    </div>
  )
}
```

### State Management
- **Use Zustand** for global state with localStorage persistence
- **Create stores** per domain (musicLeague, settings, models)
- **Use selectors** to avoid unnecessary re-renders
- **Persist critical data** only

```typescript
const { themes, activeThemeId, createTheme } = useMusicLeagueStore()
const { openRouterKey, setOpenRouterKey } = useSettingsStore()
```

### Error Handling
- **Use try-catch** for async operations
- **Throw descriptive errors** with context
- **Handle API errors** gracefully with user feedback
- **Log errors** for debugging

```typescript
async function loadSongs() {
  try {
    const response = await api.getSongs()
    return response.data
  } catch (error) {
    console.error('Failed to load songs:', error)
    throw new Error('Unable to load songs. Please try again.')
  }
}
```

### Naming Conventions
- **Components**: PascalCase (SongList, ThemeSelector)
- **Functions**: camelCase (createTheme, promoteSong)
- **Constants**: UPPER_SNAKE_CASE (FUNNEL_TIER_LIMITS)
- **Types**: PascalCase for interfaces, camelCase for type aliases
- **Files**: camelCase for components, kebab-case for utilities

### File Structure
- **Components**: `src/components/ComponentName.tsx`
- **Types**: `src/types/domain.ts`
- **Services**: `src/services/serviceName.ts`
- **Stores**: `src/stores/domainStore.ts`
- **UI primitives**: `src/components/ui/primitive.tsx`

### Styling Guidelines
- **Use Tailwind CSS** for all styling
- **shadcn/ui components** for UI primitives
- **cn() utility** for conditional classes
- **Avoid inline styles** except for dynamic values
- **Use CSS variables** for theme colors

```typescript
// Good
<div className={cn(
  'flex items-center gap-2',
  isActive && 'bg-blue-100 text-blue-900',
  className
)}>

// Avoid
<div style={{ display: 'flex', backgroundColor: isActive ? '#dbeafe' : 'transparent' }}>
```

### API Integration
- **Create service classes** for external APIs
- **Use async generators** for streaming responses
- **Handle authentication** via store/state
- **Type API responses** with interfaces

```typescript
export class OpenRouterService {
  async *streamChat(messages: Message[], model: string): AsyncGenerator<StreamChunk> {
    // Implementation
  }
}
```

### Performance Guidelines
- **Use React.memo** for expensive components
- **Implement proper key props** for lists
- **Debounce API calls** where appropriate
- **Lazy load heavy components** if needed
- **Optimize re-renders** with selectors

### Git Conventions
- **Commit messages**: Use present tense, describe what changed
- **Branch naming**: feature/description, fix/description
- **PR descriptions**: Include summary and testing notes

## Key Dependencies
- **React 19** + TypeScript
- **Vite** for build tooling
- **Tailwind CSS** + shadcn/ui for styling
- **Zustand** for state management
- **Radix UI** for component primitives
- **Lucide React** for icons

## Path Aliases
- `@/` → `src/` (configured in vite.config.ts and tsconfig.json)

## Environment Variables
- `VITE_OPENROUTER_API_KEY` - OpenRouter API key
- `VITE_DEFAULT_MODEL` - Default AI model
- Additional Spotify/YouTube OAuth variables for music services