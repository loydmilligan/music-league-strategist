import { useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  Sparkles,
  Code,
  Image,
  Brain,
  GripVertical,
  Zap,
  ZapOff,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useModelsStore } from '@/stores/modelsStore'
import { cn } from '@/lib/utils'
import type { AIModel, ModelType, CreateAIModelInput, CostTier } from '@/types/models'
import { getModelProvider, getCostTier } from '@/types/models'

const MODEL_TYPE_ICONS: Record<ModelType, typeof Sparkles> = {
  general: Sparkles,
  coding: Code,
  image: Image,
  reasoning: Brain,
}

// Map provider names (from model_id) to icon filenames
const PROVIDER_ICON_MAP: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'gemini',
  'google-vertex': 'gemini',
  deepseek: 'deepseek',
  mistralai: 'mistral',
  'x-ai': 'xai',
  minimax: 'minimax',
  'black-forest-labs': 'black_forest_labs',
}

// Fallback text badges for providers without icons
const PROVIDER_FALLBACK: Record<string, { abbr: string; color: string; bgColor: string }> = {
  'meta-llama': { abbr: 'M', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  cohere: { abbr: 'C', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  perplexity: { abbr: 'P', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  qwen: { abbr: 'Q', color: 'text-violet-600', bgColor: 'bg-violet-100' },
}

// Provider icon component - uses SVG icons with text fallback
function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const iconName = PROVIDER_ICON_MAP[provider]

  if (iconName) {
    return (
      <img
        src={`/icons/providers/dark/${iconName}.svg`}
        alt={provider}
        title={provider}
        className={cn('w-4 h-4', className)}
        onError={(e) => {
          // Hide broken images
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  // Fallback to text badge
  const fallback = PROVIDER_FALLBACK[provider] || {
    abbr: provider.slice(0, 2).toUpperCase(),
    color: 'text-gray-600',
    bgColor: 'bg-gray-100'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold',
        fallback.color,
        fallback.bgColor,
        className
      )}
      title={provider}
    >
      {fallback.abbr}
    </span>
  )
}

// Cost tier indicator component
function CostIndicator({ tier }: { tier: '$' | '$$' | '$$$' | null }) {
  if (!tier) return null

  const colors = {
    '$': 'text-green-500',
    '$$': 'text-yellow-500',
    '$$$': 'text-red-500',
  }

  return (
    <span className={cn('text-[10px] font-medium', colors[tier])} title={`Cost tier: ${tier}`}>
      {tier}
    </span>
  )
}

const EMPTY_FORM: CreateAIModelInput = {
  model_id: '',
  nickname: '',
  description: '',
  tags: [],
  favorite: false,
  model_type: 'general',
  supports_deep_reasoning: false,
  supports_streaming: true,
  input_modalities: [],
  output_modalities: [],
  context_length: undefined,
  pricing_prompt: undefined,
  pricing_completion: undefined,
  pricing_image: undefined,
  cost_tier: undefined,
}

export function ModelsManager() {
  const { models, createModel, updateModel, deleteModel, toggleFavorite, lookupModel } = useModelsStore()

  const [showDialog, setShowDialog] = useState(false)
  const [editingModel, setEditingModel] = useState<AIModel | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<AIModel | null>(null)
  const [form, setForm] = useState<CreateAIModelInput>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  const handleLookup = async () => {
    if (!form.model_id.trim()) {
      setFormError('Enter a model ID first')
      return
    }

    setIsLookingUp(true)
    setFormError(null)

    try {
      const info = await lookupModel(form.model_id)
      if (info) {
        // Parse modalities from architecture
        const inputModalities: string[] = ['text']
        const outputModalities: string[] = ['text']

        if (info.architecture?.modality?.includes('image')) {
          inputModalities.push('image')
        }

        // Detect deep reasoning models
        const isReasoningModel =
          info.id.includes('o1') ||
          info.id.includes('o3') ||
          info.id.includes('reasoning') ||
          info.name?.toLowerCase().includes('reasoning')

        setForm((prev) => ({
          ...prev,
          nickname: prev.nickname || info.name || info.id.split('/')[1] || info.id,
          description: prev.description || info.description || '',
          supports_streaming: true, // Most models support streaming
          supports_deep_reasoning: isReasoningModel,
          input_modalities: inputModalities,
          output_modalities: outputModalities,
          context_length: info.context_length || info.top_provider?.context_length,
          pricing_prompt: info.pricing?.prompt,
          pricing_completion: info.pricing?.completion,
          pricing_image: info.pricing?.image,
          model_type: isReasoningModel ? 'reasoning' : prev.model_type,
        }))
      } else {
        setFormError('Model not found on OpenRouter')
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to lookup model')
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingModel(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowDialog(true)
  }

  const handleOpenEdit = (model: AIModel) => {
    setEditingModel(model)
    setForm({
      model_id: model.model_id,
      nickname: model.nickname,
      description: model.description || '',
      tags: model.tags,
      favorite: model.favorite,
      model_type: model.model_type,
      supports_deep_reasoning: model.supports_deep_reasoning,
      supports_streaming: model.supports_streaming,
      input_modalities: model.input_modalities || [],
      output_modalities: model.output_modalities || [],
      context_length: model.context_length,
      pricing_prompt: model.pricing_prompt,
      pricing_completion: model.pricing_completion,
      pricing_image: model.pricing_image,
      cost_tier: model.cost_tier,
    })
    setFormError(null)
    setShowDialog(true)
  }

  const handleSave = () => {
    if (!form.model_id.trim() || !form.nickname.trim()) {
      setFormError('Model ID and Nickname are required')
      return
    }

    try {
      if (editingModel) {
        updateModel(editingModel.id, form)
      } else {
        createModel(form)
      }
      setShowDialog(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save model')
    }
  }

  const handleDelete = () => {
    if (!deleteConfirm) return
    try {
      deleteModel(deleteConfirm.id)
      setDeleteConfirm(null)
    } catch (e) {
      console.error('Failed to delete model:', e)
    }
  }

  const handleToggleFavorite = (model: AIModel) => {
    try {
      toggleFavorite(model.id)
    } catch (e) {
      console.error('Failed to toggle favorite:', e)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">AI Models</h3>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Add Model
        </Button>
      </div>

      {models.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No models configured. Add one to get started.
        </div>
      ) : (
        <div className="space-y-1">
          {models.map((model) => {
            const TypeIcon = MODEL_TYPE_ICONS[model.model_type] || Sparkles
            const provider = getModelProvider(model.model_id)
            const costTier = getCostTier(model.pricing_prompt, model.pricing_completion, model.cost_tier)
            const hasImageInput = model.input_modalities?.includes('image')
            const hasImageOutput = model.output_modalities?.includes('image')

            return (
              <div
                key={model.id}
                className="flex items-center gap-2 rounded-md border border-border bg-card/50 p-2"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <button
                  onClick={() => handleToggleFavorite(model)}
                  className="p-1 hover:bg-muted/50 rounded"
                >
                  <Star
                    className={cn(
                      'h-4 w-4 transition-colors',
                      model.favorite
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-muted-foreground'
                    )}
                  />
                </button>
                <ProviderIcon provider={provider} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate">{model.nickname}</span>
                    <CostIndicator tier={costTier} />
                    {model.supports_streaming ? (
                      <span title="Supports streaming"><Zap className="h-3 w-3 text-green-500" /></span>
                    ) : (
                      <span title="No streaming"><ZapOff className="h-3 w-3 text-muted-foreground" /></span>
                    )}
                    {model.supports_deep_reasoning && (
                      <span title="Deep reasoning"><Brain className="h-3 w-3 text-purple-500" /></span>
                    )}
                    {hasImageInput && (
                      <span title="Accepts images"><Image className="h-3 w-3 text-blue-500" /></span>
                    )}
                    {hasImageOutput && (
                      <span title="Generates images"><Image className="h-3 w-3 text-pink-500" /></span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {model.model_id}
                    {model.context_length && (
                      <span className="ml-2 text-[10px]">
                        {(model.context_length / 1000).toFixed(0)}k ctx
                      </span>
                    )}
                  </div>
                </div>
                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleOpenEdit(model)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirm(model)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingModel ? 'Edit Model' : 'Add Model'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formError && (
              <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="model-id">Model ID (OpenRouter)</Label>
              <div className="flex gap-2">
                <Input
                  id="model-id"
                  value={form.model_id}
                  onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                  placeholder="anthropic/claude-sonnet-4"
                  className="font-mono text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLookup}
                  disabled={isLookingUp || !form.model_id.trim()}
                  title="Fetch details from OpenRouter"
                >
                  {isLookingUp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Exact ID from OpenRouter — click refresh to auto-fill details
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                placeholder="Claude Sonnet 4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Fast and capable general-purpose model"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model-type">Type</Label>
                <Select
                  value={form.model_type}
                  onValueChange={(value: ModelType) => setForm({ ...form, model_type: value })}
                >
                  <SelectTrigger id="model-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="coding">Coding</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="reasoning">Reasoning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-tier">Cost Tier</Label>
                <Select
                  value={form.cost_tier || 'auto'}
                  onValueChange={(value: string) => setForm({ ...form, cost_tier: value === 'auto' ? undefined : value as CostTier })}
                >
                  <SelectTrigger id="cost-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (from pricing)</SelectItem>
                    <SelectItem value="$">
                      <span className="text-green-500 font-medium">$</span> — Cheap
                    </SelectItem>
                    <SelectItem value="$$">
                      <span className="text-yellow-500 font-medium">$$</span> — Mid-range
                    </SelectItem>
                    <SelectItem value="$$$">
                      <span className="text-red-500 font-medium">$$$</span> — Expensive
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Supports Streaming</Label>
                <p className="text-xs text-muted-foreground">Real-time response display</p>
              </div>
              <Switch
                checked={form.supports_streaming}
                onCheckedChange={(checked) => setForm({ ...form, supports_streaming: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Deep Reasoning</Label>
                <p className="text-xs text-muted-foreground">Extended thinking capability</p>
              </div>
              <Switch
                checked={form.supports_deep_reasoning}
                onCheckedChange={(checked) => setForm({ ...form, supports_deep_reasoning: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Favorite</Label>
                <p className="text-xs text-muted-foreground">Show at top of list</p>
              </div>
              <Switch
                checked={form.favorite}
                onCheckedChange={(checked) => setForm({ ...form, favorite: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingModel ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open: boolean) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.nickname}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
