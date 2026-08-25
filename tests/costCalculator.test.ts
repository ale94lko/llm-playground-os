import { describe, expect, it } from 'vitest'
import {
  calculateCost,
  estimateTokens,
  formatCost,
  formatLatency,
} from '../app/composables/useCostCalculator'
import type { ProviderModel } from '../app/types/llm'

const model: ProviderModel = {
  id: 'gpt-4o-mini',
  label: 'GPT-4o Mini',
  provider: 'openai',
  inputCostPer1M: 0.15,
  outputCostPer1M: 0.6,
}

describe('useCostCalculator', () => {
  it('estimates tokens from text length', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('hello world!')).toBe(3)
  })

  it('calculates cost from token counts', () => {
    const cost = calculateCost(model, 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(0.75)
  })

  it('returns zero cost when model is undefined', () => {
    expect(calculateCost(undefined, 1000, 1000)).toBe(0)
  })

  it('formats cost for display', () => {
    expect(formatCost(0)).toBe('$0.00')
    expect(formatCost(0.00005)).toBe('<$0.0001')
    expect(formatCost(0.005)).toBe('$0.0050')
    expect(formatCost(0.12)).toBe('$0.120')
  })

  it('formats latency for display', () => {
    expect(formatLatency(450)).toBe('450ms')
    expect(formatLatency(1500)).toBe('1.50s')
  })
})
