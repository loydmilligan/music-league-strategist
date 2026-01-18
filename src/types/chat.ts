// Chat types for OpenRouter integration

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export interface ChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      reasoning?: string
    }
    finish_reason: string | null
  }>
}

export type StreamChunk =
  | { type: 'content'; text: string }
  | { type: 'reasoning'; text: string }
