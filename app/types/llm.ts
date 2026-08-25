export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama'

export interface ProviderModel {
  id: string
  label: string
  provider: ProviderId
  inputCostPer1M: number
  outputCostPer1M: number
}

export interface SelectedModel {
  slotId: string
  provider: ProviderId
  modelId: string
}

export interface StreamMetrics {
  latencyMs: number
  ttftMs: number | null
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'

export interface ModelResponse {
  slotId: string
  provider: ProviderId
  modelId: string
  content: string
  status: StreamStatus
  metrics: StreamMetrics
  error?: string
}

export interface PromptVariables {
  [key: string]: string
}

export interface SavedPrompt {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
  tags: string[]
  version: number
  createdAt: string
  updatedAt: string
}

export interface ExecutionHistoryEntry {
  id: string
  systemPrompt: string
  userPrompt: string
  variables: PromptVariables
  models: SelectedModel[]
  responses: ModelResponse[]
  createdAt: string
}

export interface StreamRequest {
  provider: ProviderId
  model: string
  systemPrompt: string
  userPrompt: string
  apiKey?: string
  ollamaUrl?: string
}
