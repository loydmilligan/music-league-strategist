// CSVImportModal Component (Feature 8)
// Import wizard for Music League CSV exports

import { useState, useCallback } from 'react'
import {
  Upload,
  FileText,
  Check,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useMusicLeagueStore } from '@/stores/musicLeagueStore'
import { importMusicLeagueData, validateCSVFiles } from '@/services/csvImport'
import { cn } from '@/lib/utils'

interface CSVImportModalProps {
  trigger?: React.ReactNode
}

interface FileState {
  file: File | null
  content: string | null
  error: string | null
}

const REQUIRED_FILES = [
  { key: 'rounds', label: 'rounds.csv', description: 'Round information' },
  { key: 'submissions', label: 'submissions.csv', description: 'Song submissions' },
  { key: 'competitors', label: 'competitors.csv', description: 'Competitor names' },
  { key: 'votes', label: 'votes.csv', description: 'Voting data' },
] as const

type FileKey = typeof REQUIRED_FILES[number]['key']

export function CSVImportModal({ trigger }: CSVImportModalProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [leagueName, setLeagueName] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  const [files, setFiles] = useState<Record<FileKey, FileState>>({
    rounds: { file: null, content: null, error: null },
    submissions: { file: null, content: null, error: null },
    competitors: { file: null, content: null, error: null },
    votes: { file: null, content: null, error: null },
  })

  const setCompetitorAnalysis = useMusicLeagueStore((s) => s.setCompetitorAnalysis)

  const handleFileChange = useCallback(async (key: FileKey, file: File | null) => {
    if (!file) {
      setFiles(prev => ({
        ...prev,
        [key]: { file: null, content: null, error: null },
      }))
      return
    }

    try {
      const content = await file.text()
      setFiles(prev => ({
        ...prev,
        [key]: { file, content, error: null },
      }))
    } catch (err) {
      setFiles(prev => ({
        ...prev,
        [key]: { file, content: null, error: 'Failed to read file' },
      }))
    }
  }, [])

  const allFilesLoaded = Object.values(files).every(f => f.content !== null)

  const handleImport = useCallback(async () => {
    if (!allFilesLoaded) return

    setIsImporting(true)
    setImportError(null)

    try {
      // Validate CSV files
      const validation = validateCSVFiles(
        files.rounds.content!,
        files.submissions.content!,
        files.competitors.content!,
        files.votes.content!
      )

      if (!validation.valid) {
        setImportError(`Validation errors:\n${validation.errors.join('\n')}`)
        return
      }

      // Import data
      const data = importMusicLeagueData(
        files.rounds.content!,
        files.submissions.content!,
        files.competitors.content!,
        files.votes.content!,
        leagueName || undefined
      )

      setCompetitorAnalysis(data)
      setImportSuccess(true)

      // Close after success
      setTimeout(() => {
        setOpen(false)
        // Reset state
        setImportSuccess(false)
        setFiles({
          rounds: { file: null, content: null, error: null },
          submissions: { file: null, content: null, error: null },
          competitors: { file: null, content: null, error: null },
          votes: { file: null, content: null, error: null },
        })
        setLeagueName('')
      }, 1500)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }, [allFilesLoaded, files, leagueName, setCompetitorAnalysis])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Music League Data
          </DialogTitle>
          <DialogDescription>
            Upload your Music League CSV exports to analyze competitor performance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* League Name */}
          <div className="space-y-2">
            <Label htmlFor="league-name" className="text-xs">
              League Name (optional)
            </Label>
            <Input
              id="league-name"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              placeholder="My Music League"
            />
          </div>

          {/* File Inputs */}
          <div className="space-y-3">
            {REQUIRED_FILES.map(({ key, label, description }) => {
              const fileState = files[key]
              const hasFile = fileState.content !== null
              const hasError = fileState.error !== null

              return (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`file-${key}`} className="text-xs flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    {label}
                    <span className="text-muted-foreground font-normal">
                      - {description}
                    </span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`file-${key}`}
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleFileChange(key, e.target.files?.[0] || null)}
                      className={cn(
                        'text-xs',
                        hasFile && 'border-green-500',
                        hasError && 'border-red-500'
                      )}
                    />
                    {hasFile && !hasError && (
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                    {hasError && (
                      <X className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  {hasError && (
                    <p className="text-xs text-red-500">{fileState.error}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Error display */}
          {importError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs whitespace-pre-wrap">
                {importError}
              </AlertDescription>
            </Alert>
          )}

          {/* Success display */}
          {importSuccess && (
            <Alert className="border-green-500 bg-green-500/10">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-xs text-green-500">
                Data imported successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Import button */}
          <Button
            className="w-full"
            onClick={handleImport}
            disabled={!allFilesLoaded || isImporting || importSuccess}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : importSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Imported!
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import Data
              </>
            )}
          </Button>

          {/* Help text */}
          <p className="text-xs text-muted-foreground">
            Export these files from Music League's web interface under League Settings → Export.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
