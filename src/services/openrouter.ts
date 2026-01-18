import type { ChatCompletionRequest, ChatCompletionChunk, StreamChunk } from '@/types/chat'
import { useSettingsStore } from '@/stores/settingsStore'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'

export class OpenRouterService {
  private getApiKey(): string {
    return useSettingsStore.getState().openRouterKey
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.getApiKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Music League Strategist',
    }
  }

  async *streamChat(
    messages: ChatCompletionRequest['messages'],
    model: string,
    options?: Partial<ChatCompletionRequest>
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Please add it in Settings.')
    }

    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...options,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(error.error?.message || `API error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()

          if (!trimmed || !trimmed.startsWith('data: ')) {
            continue
          }

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            return
          }

          try {
            const parsed: ChatCompletionChunk = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta

            // Handle reasoning tokens (for reasoning models like o1, DeepSeek, GLM-4)
            const reasoning = delta?.reasoning
            if (reasoning) {
              yield { type: 'reasoning', text: reasoning }
            }

            // Handle content tokens
            const content = delta?.content
            if (content) {
              yield { type: 'content', text: content }
            }
          } catch {
            // Skip unparseable data
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async chat(
    messages: ChatCompletionRequest['messages'],
    model: string,
    options?: Partial<ChatCompletionRequest>
  ): Promise<string> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Please add it in Settings.')
    }

    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        ...options,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(error.error?.message || `API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  async getModels(): Promise<Array<{ id: string; name: string }>> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured')
    }

    const response = await fetch(`${OPENROUTER_API_URL}/models`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.map((m: { id: string; name: string }) => ({
      id: m.id,
      name: m.name,
    })) || []
  }
}

// Singleton instance
export const openRouterService = new OpenRouterService()
