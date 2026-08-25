import { describe, expect, it } from 'vitest'
import {
  aggregateFromHistory,
  aggregateFromResponses,
  buildLatencyTimeline,
  toChartData,
} from '../app/lib/metrics'
import type { ExecutionHistoryEntry, ModelResponse } from '../app/types/llm'

const sampleResponse = (modelId: string, latencyMs: number, cost: number): ModelResponse => ({
  slotId: 's1',
  provider: 'openai',
  modelId,
  content: 'hi',
  status: 'done',
  metrics: {
    latencyMs,
    ttftMs: latencyMs * 0.3,
    inputTokens: 20,
    outputTokens: 50,
    costUsd: cost,
  },
})

describe('metrics', () => {
  it('aggregates historical runs by model', () => {
    const history: ExecutionHistoryEntry[] = [{
      id: '1',
      systemPrompt: '',
      userPrompt: 'test',
      variables: {},
      models: [],
      responses: [
        sampleResponse('gpt-4o-mini', 400, 0.001),
        sampleResponse('gemini-3.6-flash', 600, 0.0005),
      ],
      createdAt: '2026-01-01T00:00:00Z',
    }]

    const agg = aggregateFromHistory(history)
    expect(agg).toHaveLength(2)
    expect(agg[0].modelId).toBe('gpt-4o-mini')
    expect(agg[0].avgLatencyMs).toBe(400)
  })

  it('aggregates latest responses', () => {
    const agg = aggregateFromResponses([
      sampleResponse('gpt-4o', 800, 0.01),
    ])
    expect(agg[0].avgLatencyMs).toBe(800)
  })

  it('builds chart data with percentages', () => {
    const agg = aggregateFromResponses([
      sampleResponse('gpt-4o-mini', 200, 0.001),
      sampleResponse('gpt-4o', 400, 0.01),
    ])
    const chart = toChartData(agg, a => a.avgLatencyMs)
    expect(chart[1].percent).toBe(100)
    expect(chart[0].percent).toBe(50)
  })

  it('builds latency timeline from history', () => {
    const history: ExecutionHistoryEntry[] = [{
      id: '1',
      systemPrompt: '',
      userPrompt: 'test',
      variables: {},
      models: [],
      responses: [sampleResponse('gpt-4o-mini', 300, 0.001)],
      createdAt: '2026-01-01T00:00:00Z',
    }]
    const timeline = buildLatencyTimeline(history)
    expect(timeline).toHaveLength(1)
    expect(timeline[0].latencyMs).toBe(300)
  })
})
