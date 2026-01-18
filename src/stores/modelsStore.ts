import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIModel, CreateAIModelInput, UpdateAIModelInput, OpenRouterModelInfo } from '@/types/models'
import { generateModelId } from '@/types/models'

// Default models to seed on first run
const DEFAULT_MODELS: Omit<AIModel, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    model_id: 'anthropic/claude-sonnet-4',
    nickname: 'Claude Sonnet 4',
    description: 'Latest and most capable Sonnet model',
    tags: [],
    favorite: true,
    model_type: 'general',
    supports_deep_reasoning: false,
    supports_streaming: true,
    sort_order: 0,
    input_modalities: ['text', 'image'],
    output_modalities: ['text'],
    context_length: 200000,
    pricing_prompt: '0.000003',
    pricing_completion: '0.000015',
    cost_tier: '$$',
  },
  {
    model_id: 'anthropic/claude-3.5-sonnet',
    nickname: 'Claude 3.5 Sonnet',
    description: 'Previous generation Sonnet, still excellent',
    tags: [],
    favorite: false,
    model_type: 'general',
    supports_deep_reasoning: false,
    supports_streaming: true,
    sort_order: 1,
    input_modalities: ['text', 'image'],
    output_modalities: ['text'],
    context_length: 200000,
    pricing_prompt: '0.000003',
    pricing_completion: '0.000015',
    cost_tier: '$$',
  },
  {
    model_id: 'openai/gpt-4o',
    nickname: 'GPT-4o',
    description: 'OpenAI flagship multimodal model',
    tags: [],
    favorite: false,
    model_type: 'general',
    supports_deep_reasoning: false,
    supports_streaming: true,
    sort_order: 2,
    input_modalities: ['text', 'image'],
    output_modalities: ['text'],
    context_length: 128000,
    pricing_prompt: '0.0000025',
    pricing_completion: '0.00001',
    cost_tier: '$$',
  },
  {
    model_id: 'google/gemini-2.0-flash-001',
    nickname: 'Gemini 2.0 Flash',
    description: 'Fast and capable Google model',
    tags: [],
    favorite: false,
    model_type: 'general',
    supports_deep_reasoning: false,
    supports_streaming: true,
    sort_order: 3,
    input_modalities: ['text', 'image'],
    output_modalities: ['text'],
    context_length: 1000000,
    pricing_prompt: '0.0000001',
    pricing_completion: '0.0000004',
    cost_tier: '$',
  },
  {
    model_id: 'anthropic/claude-3-haiku',
    nickname: 'Claude 3 Haiku',
    description: 'Fast and cheap for simple tasks',
    tags: [],
    favorite: false,
    model_type: 'general',
    supports_deep_reasoning: false,
    supports_streaming: true,
    sort_order: 4,
    input_modalities: ['text', 'image'],
    output_modalities: ['text'],
    context_length: 200000,
    pricing_prompt: '0.00000025',
    pricing_completion: '0.00000125',
    cost_tier: '$',
  },
  {
    model_id: 'deepseek/deepseek-chat',
    nickname: 'DeepSeek V3',
    description: 'Very capable and extremely affordable',
    tags: [],
    favorite: false,
    model_type: 'general',
    supports_deep_reasoning: false,
    supports_streaming: true,
    sort_order: 5,
    input_modalities: ['text'],
    output_modalities: ['text'],
    context_length: 64000,
    pricing_prompt: '0.00000014',
    pricing_completion: '0.00000028',
    cost_tier: '$',
  },
]

interface ModelsState {
  models: AIModel[]
  isLoading: boolean
  error: string | null
  initialized: boolean

  // Actions
  createModel: (input: CreateAIModelInput) => AIModel
  updateModel: (id: string, input: UpdateAIModelInput) => AIModel | null
  deleteModel: (id: string) => void
  reorderModels: (modelIds: string[]) => void
  toggleFavorite: (id: string) => void
  lookupModel: (modelId: string) => Promise<OpenRouterModelInfo | null>

  // Helpers
  getModelByOpenRouterId: (modelId: string) => AIModel | undefined
  getNickname: (modelId: string) => string
}

export const useModelsStore = create<ModelsState>()(
  persist(
    (set, get) => ({
      models: [],
      isLoading: false,
      error: null,
      initialized: false,

      createModel: (input) => {
        const now = new Date().toISOString()
        const maxOrder = Math.max(...get().models.map((m) => m.sort_order), -1)

        const newModel: AIModel = {
          id: generateModelId(),
          model_id: input.model_id,
          nickname: input.nickname,
          description: input.description || '',
          tags: input.tags || [],
          favorite: input.favorite || false,
          model_type: input.model_type || 'general',
          supports_deep_reasoning: input.supports_deep_reasoning || false,
          supports_streaming: input.supports_streaming ?? true,
          sort_order: input.sort_order ?? maxOrder + 1,
          input_modalities: input.input_modalities || [],
          output_modalities: input.output_modalities || [],
          context_length: input.context_length,
          pricing_prompt: input.pricing_prompt,
          pricing_completion: input.pricing_completion,
          pricing_image: input.pricing_image,
          cost_tier: input.cost_tier,
          created_at: now,
          updated_at: now,
        }

        set((state) => ({
          models: [...state.models, newModel].sort((a, b) => {
            // Favorites first, then by sort_order
            if (a.favorite !== b.favorite) return b.favorite ? 1 : -1
            return a.sort_order - b.sort_order
          }),
        }))

        return newModel
      },

      updateModel: (id, input) => {
        const model = get().models.find((m) => m.id === id)
        if (!model) return null

        const updatedModel: AIModel = {
          ...model,
          ...input,
          updated_at: new Date().toISOString(),
        }

        set((state) => ({
          models: state.models.map((m) => (m.id === id ? updatedModel : m)).sort((a, b) => {
            if (a.favorite !== b.favorite) return b.favorite ? 1 : -1
            return a.sort_order - b.sort_order
          }),
        }))

        return updatedModel
      },

      deleteModel: (id) => {
        set((state) => ({
          models: state.models.filter((m) => m.id !== id),
        }))
      },

      reorderModels: (modelIds) => {
        set((state) => {
          const reordered = modelIds.map((id, index) => {
            const model = state.models.find((m) => m.id === id)
            if (model) {
              return { ...model, sort_order: index, updated_at: new Date().toISOString() }
            }
            return null
          }).filter(Boolean) as AIModel[]

          // Add any models not in the reorder list
          const remaining = state.models.filter((m) => !modelIds.includes(m.id))

          return {
            models: [...reordered, ...remaining].sort((a, b) => {
              if (a.favorite !== b.favorite) return b.favorite ? 1 : -1
              return a.sort_order - b.sort_order
            }),
          }
        })
      },

      toggleFavorite: (id) => {
        const model = get().models.find((m) => m.id === id)
        if (!model) return

        set((state) => ({
          models: state.models.map((m) =>
            m.id === id
              ? { ...m, favorite: !m.favorite, updated_at: new Date().toISOString() }
              : m
          ).sort((a, b) => {
            if (a.favorite !== b.favorite) return b.favorite ? 1 : -1
            return a.sort_order - b.sort_order
          }),
        }))
      },

      lookupModel: async (modelId: string): Promise<OpenRouterModelInfo | null> => {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/models')
          if (!response.ok) {
            throw new Error('Failed to fetch models from OpenRouter')
          }

          const data = await response.json()
          const model = data.data?.find((m: OpenRouterModelInfo) => m.id === modelId)

          return model || null
        } catch (error) {
          console.error('Failed to lookup model:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to lookup model' })
          return null
        }
      },

      getModelByOpenRouterId: (modelId: string) => {
        return get().models.find((m) => m.model_id === modelId)
      },

      getNickname: (modelId: string) => {
        const model = get().models.find((m) => m.model_id === modelId)
        if (model) return model.nickname
        // Fallback: extract name from model_id (e.g., "anthropic/claude-3" -> "claude-3")
        const parts = modelId.split('/')
        return parts[parts.length - 1] || modelId
      },
    }),
    {
      name: 'music-league-models',
      // Seed default models on first load
      onRehydrateStorage: () => (state) => {
        if (state && state.models.length === 0) {
          const now = new Date().toISOString()
          const seededModels = DEFAULT_MODELS.map((m, index) => ({
            ...m,
            id: generateModelId(),
            sort_order: index,
            created_at: now,
            updated_at: now,
          }))
          state.models = seededModels
          state.initialized = true
        } else if (state) {
          state.initialized = true
        }
      },
    }
  )
)

// Helper to check if models are loaded
export const areModelsInitialized = (): boolean => {
  return useModelsStore.getState().initialized
}
