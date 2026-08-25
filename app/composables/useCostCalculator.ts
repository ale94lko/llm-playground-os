import type { ProviderModel } from '~/types/llm'

/** Rough token estimate: ~4 chars per token for English text */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function calculateCost(
  model: ProviderModel | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  if (!model) return 0
  const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M
  return inputCost + outputCost
}

export function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.0001) return '<$0.0001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(3)}`
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function useCostCalculator() {
  return {
    estimateTokens,
    calculateCost,
    formatCost,
    formatLatency,
  }
}
