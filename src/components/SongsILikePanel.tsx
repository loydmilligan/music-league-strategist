// SongsILikePanel Component (Feature 6)
// Displays the persistent "Songs I Like" collection

import { useState } from 'react'
import {
  Heart,
  Plus,
  X,
  Tag,
  Music,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import type { SavedSong } from '@/types/musicLeague'
import { cn } from '@/lib/utils'

interface SongsILikePanelProps {
  trigger?: React.ReactNode
  className?: string
}

function SongCard({
  song,
  onRemove,
  onAddToTheme,
  onUpdateTags,
  activeThemeId,
}: {
  song: SavedSong
  onRemove: (id: string) => void
  onAddToTheme: (id: string) => void
  onUpdateTags: (id: string, tags: string[]) => void
  activeThemeId: string | null
}): React.ReactElement {
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [newTag, setNewTag] = useState('')

  const handleAddTag = () => {
    if (newTag.trim() && !song.tags?.includes(newTag.trim())) {
      onUpdateTags(song.id, [...(song.tags || []), newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTags(song.id, (song.tags || []).filter(t => t !== tagToRemove))
  }

  const youtubeUrl = song.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${song.youtubeVideoId}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{song.title}</p>
          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
          >
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onRemove(song.id)}
          >
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {song.tags?.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="text-[10px] px-1.5 py-0 gap-0.5"
          >
            <Tag className="h-2 w-2" />
            {tag}
            {isEditingTags && (
              <button
                onClick={() => handleRemoveTag(tag)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-2 w-2" />
              </button>
            )}
          </Badge>
        ))}
        {!isEditingTags && (
          <button
            onClick={() => setIsEditingTags(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            + tag
          </button>
        )}
      </div>

      {/* Tag input */}
      {isEditingTags && (
        <div className="flex gap-1">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTag()
              } else if (e.key === 'Escape') {
                setIsEditingTags(false)
              }
            }}
            placeholder="Add tag..."
            className="h-6 text-xs"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsEditingTags(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Notes */}
      {song.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {song.notes}
        </p>
      )}

      {/* Saved date */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Saved {new Date(song.savedAt).toLocaleDateString()}</span>
        {activeThemeId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] gap-1"
            onClick={() => onAddToTheme(song.id)}
          >
            <Plus className="h-2.5 w-2.5" />
            Add to theme
          </Button>
        )}
      </div>
    </div>
  )
}

export function SongsILikePanel({
  trigger,
  className,
}: SongsILikePanelProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [filterTag, setFilterTag] = useState<string | null>(null)

  const {
    songsILike,
    activeThemeId,
    removeFromSongsILike,
    updateSongILikeTags,
    addSongFromCollection,
  } = useMusicLeagueStore()

  // Get all unique tags
  const allTags = Array.from(
    new Set(songsILike.flatMap(s => s.tags || []))
  ).sort()

  // Filter songs by tag
  const filteredSongs = filterTag
    ? songsILike.filter(s => s.tags?.includes(filterTag))
    : songsILike

  // Group songs by tag (for display)
  const songsByTag = new Map<string, SavedSong[]>()
  for (const song of songsILike) {
    if (!song.tags || song.tags.length === 0) {
      const untagged = songsByTag.get('__untagged__') || []
      songsByTag.set('__untagged__', [...untagged, song])
    } else {
      for (const tag of song.tags) {
        const tagged = songsByTag.get(tag) || []
        songsByTag.set(tag, [...tagged, song])
      }
    }
  }

  const handleAddToTheme = (songId: string) => {
    if (activeThemeId) {
      addSongFromCollection(songId, activeThemeId)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className={cn('gap-2', className)}>
            <Heart className="h-4 w-4" />
            Songs I Like
            {songsILike.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {songsILike.length}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Songs I Like
            <Badge variant="secondary">{songsILike.length}</Badge>
          </SheetTitle>
        </SheetHeader>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="px-4 py-2 border-b">
            <div className="flex flex-wrap gap-1">
              <Button
                variant={filterTag === null ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 text-xs"
                onClick={() => setFilterTag(null)}
              >
                All
              </Button>
              {allTags.map((tag) => (
                <Button
                  key={tag}
                  variant={filterTag === tag ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {filteredSongs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No songs saved yet</p>
                <p className="text-xs mt-1">
                  Save songs from the song detail slideout
                </p>
              </div>
            ) : (
              filteredSongs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  onRemove={removeFromSongsILike}
                  onAddToTheme={handleAddToTheme}
                  onUpdateTags={updateSongILikeTags}
                  activeThemeId={activeThemeId}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// Compact trigger button for header
export function SongsILikeButton({
  className,
}: {
  className?: string
}): React.ReactElement {
  const songsILike = useMusicLeagueStore((s) => s.songsILike)

  return (
    <SongsILikePanel
      className={className}
      trigger={
        <Button variant="ghost" size="icon" className={cn('h-8 w-8 relative', className)}>
          <Heart className="h-4 w-4" />
          {songsILike.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {songsILike.length > 9 ? '9+' : songsILike.length}
            </span>
          )}
        </Button>
      }
    />
  )
}
