export type ModelType = 'general' | 'coding' | 'image' | 'reasoning'
export type CostTier = '$' | '$$' | '$$$'

// Provider extracted from model_id (e.g., "anthropic" from "anthropic/claude-3.5-sonnet")
export type ModelProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'meta-llama'
  | 'mistralai'
  | 'deepseek'
  | 'cohere'
  | 'perplexity'
  | 'qwen'
  | 'x-ai'
  | string // fallback for unknown providers

export interface AIModel {
  id: string // UUID for localStorage
  model_id: string // OpenRouter model ID (e.g., "anthropic/claude-sonnet-4")
  nickname: string // Display name for UI
  description?: string
  tags: string[]
  favorite: boolean
  model_type: ModelType
  supports_deep_reasoning: boolean
  supports_streaming: boolean
  sort_order: number
  // OpenRouter metadata
  input_modalities: string[]
  output_modalities: string[]
  context_length?: number
  pricing_prompt?: string
  pricing_completion?: string
  pricing_image?: string
  cost_tier?: CostTier // Manual override for cost tier
  created_at: string
  updated_at: string
}

export interface CreateAIModelInput {
  model_id: string
  nickname: string
  description?: string
  tags?: string[]
  favorite?: boolean
  model_type?: ModelType
  supports_deep_reasoning?: boolean
  supports_streaming?: boolean
  sort_order?: number
  input_modalities?: string[]
  output_modalities?: string[]
  context_length?: number
  pricing_prompt?: string
  pricing_completion?: string
  pricing_image?: string
  cost_tier?: CostTier
}

export interface UpdateAIModelInput {
  model_id?: string
  nickname?: string
  description?: string
  tags?: string[]
  favorite?: boolean
  model_type?: ModelType
  supports_deep_reasoning?: boolean
  supports_streaming?: boolean
  sort_order?: number
  input_modalities?: string[]
  output_modalities?: string[]
  context_length?: number
  pricing_prompt?: string
  pricing_completion?: string
  pricing_image?: string
  cost_tier?: CostTier
}

// Response from OpenRouter API lookup
export interface OpenRouterModelInfo {
  id: string
  name: string
  description?: string
  context_length?: number
  architecture?: {
    modality: string
    tokenizer: string
    instruct_type?: string
  }
  pricing?: {
    prompt: string
    completion: string
    image?: string
  }
  top_provider?: {
    context_length?: number
    max_completion_tokens?: number
    is_moderated?: boolean
  }
}

// Helper to extract provider from model_id
export function getModelProvider(modelId: string): ModelProvider {
  return modelId.split('/')[0] || 'unknown'
}

// Helper to calculate cost tier ($, $$, $$$)
// If costTierOverride is set, it takes precedence over calculated value
export function getCostTier(pricingPrompt?: string, pricingCompletion?: string, costTierOverride?: CostTier): CostTier | null {
  // Manual override takes precedence
  if (costTierOverride) return costTierOverride

  if (!pricingPrompt && !pricingCompletion) return null

  // Average of prompt and completion cost per 1M tokens
  const prompt = parseFloat(pricingPrompt || '0') * 1_000_000
  const completion = parseFloat(pricingCompletion || '0') * 1_000_000
  const avgCost = (prompt + completion) / 2

  // Tiers based on cost per 1M tokens:
  // $ = < $1 (cheap models like Haiku, Gemini Flash)
  // $$ = $1-$10 (mid-range like Sonnet, GPT-4o)
  // $$$ = > $10 (expensive like Opus, o1)
  if (avgCost < 1) return '$'
  if (avgCost < 10) return '$$'
  return '$$$'
}

// Generate a unique ID
export function generateModelId(): string {
  return crypto.randomUUID()
}
