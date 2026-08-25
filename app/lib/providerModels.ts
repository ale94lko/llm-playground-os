import type { ProviderModel } from '~/types/llm'

export const PROVIDER_MODELS: ProviderModel[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', inputCostPer1M: 0.15, outputCostPer1M: 0.6 },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', inputCostPer1M: 2.5, outputCostPer1M: 10 },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'anthropic', inputCostPer1M: 0.8, outputCostPer1M: 4 },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic', inputCostPer1M: 3, outputCostPer1M: 15 },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', provider: 'gemini', inputCostPer1M: 0.15, outputCostPer1M: 0.6 },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini', inputCostPer1M: 1.25, outputCostPer1M: 10 },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', provider: 'gemini', inputCostPer1M: 0.075, outputCostPer1M: 0.3 },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', provider: 'groq', inputCostPer1M: 0.59, outputCostPer1M: 0.79 },
  { id: 'llama3.2', label: 'Llama 3.2 (Ollama)', provider: 'ollama', inputCostPer1M: 0, outputCostPer1M: 0 },
  { id: 'mistral', label: 'Mistral (Ollama)', provider: 'ollama', inputCostPer1M: 0, outputCostPer1M: 0 },
]

/** Retired model IDs mapped to current replacements */
export const DEPRECATED_MODEL_MAP: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.0-flash-001': 'gemini-3.6-flash',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash-lite-001': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash': 'gemini-3.6-flash',
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini-2.5-pro-preview-05-06': 'gemini-2.5-pro',
}

export function migrateModelId(modelId: string): string {
  return DEPRECATED_MODEL_MAP[modelId] ?? modelId
}
