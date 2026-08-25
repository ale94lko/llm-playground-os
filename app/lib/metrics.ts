import type { ExecutionHistoryEntry, ModelResponse, ProviderId } from '~/types/llm'
import { PROVIDER_MODELS } from './providerModels'

export interface ModelMetricAggregate {
  modelId: string
  label: string
  provider: ProviderId
  runs: number
  successCount: number
  avgLatencyMs: number
  avgTtftMs: number | null
  avgInputTokens: number
  avgOutputTokens: number
  avgCostUsd: number
  totalCostUsd: number
}

export interface ChartDatum {
  label: string
  value: number
  sublabel?: string
  color?: string
  percent: number
}

export interface TimelinePoint {
  date: string
  modelId: string
  label: string
  latencyMs: number
}

const CHART_COLORS = [
  '#4ade80', // primary green
  '#60a5fa', // blue
  '#f472b6', // pink
  '#fbbf24', // amber
  '#a78bfa', // purple
  '#2dd4bf', // teal
  '#fb923c', // orange
  '#94a3b8', // slate
]

export function modelLabel(modelId: string): string {
  return PROVIDER_MODELS.find(m => m.id === modelId)?.label ?? modelId
}

export function colorForIndex(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export function aggregateFromHistory(history: ExecutionHistoryEntry[]): ModelMetricAggregate[] {
  const map = new Map<string, {
    provider: ProviderId
    latencies: number[]
    ttfts: number[]
    inputTokens: number[]
    outputTokens: number[]
    costs: number[]
    success: number
  }>()

  for (const entry of history) {
    for (const response of entry.responses) {
      if (response.status === 'idle') continue

      let bucket = map.get(response.modelId)
      if (!bucket) {
        bucket = {
          provider: response.provider,
          latencies: [],
          ttfts: [],
          inputTokens: [],
          outputTokens: [],
          costs: [],
          success: 0,
        }
        map.set(response.modelId, bucket)
      }

      bucket.latencies.push(response.metrics.latencyMs)
      if (response.metrics.ttftMs != null) bucket.ttfts.push(response.metrics.ttftMs)
      bucket.inputTokens.push(response.metrics.inputTokens)
      bucket.outputTokens.push(response.metrics.outputTokens)
      bucket.costs.push(response.metrics.costUsd)
      if (response.status === 'done') bucket.success += 1
    }
  }

  return [...map.entries()]
    .map(([modelId, data]) => ({
      modelId,
      label: modelLabel(modelId),
      provider: data.provider,
      runs: data.latencies.length,
      successCount: data.success,
      avgLatencyMs: average(data.latencies),
      avgTtftMs: data.ttfts.length ? average(data.ttfts) : null,
      avgInputTokens: average(data.inputTokens),
      avgOutputTokens: average(data.outputTokens),
      avgCostUsd: average(data.costs),
      totalCostUsd: sum(data.costs),
    }))
    .sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
}

export function aggregateFromResponses(responses: ModelResponse[]): ModelMetricAggregate[] {
  return responses
    .filter(r => r.status !== 'idle')
    .map(r => ({
      modelId: r.modelId,
      label: modelLabel(r.modelId),
      provider: r.provider,
      runs: 1,
      successCount: r.status === 'done' ? 1 : 0,
      avgLatencyMs: r.metrics.latencyMs,
      avgTtftMs: r.metrics.ttftMs,
      avgInputTokens: r.metrics.inputTokens,
      avgOutputTokens: r.metrics.outputTokens,
      avgCostUsd: r.metrics.costUsd,
      totalCostUsd: r.metrics.costUsd,
    }))
}

export function toChartData(
  aggregates: ModelMetricAggregate[],
  pick: (a: ModelMetricAggregate) => number,
  format?: (v: number) => string,
): ChartDatum[] {
  const values = aggregates.map(pick)
  const max = Math.max(...values, 0.0001)

  return aggregates.map((agg, i) => {
    const value = pick(agg)
    return {
      label: agg.label,
      value,
      sublabel: format ? format(value) : String(Math.round(value)),
      color: colorForIndex(i),
      percent: (value / max) * 100,
    }
  })
}

export function buildLatencyTimeline(history: ExecutionHistoryEntry[], limit = 20): TimelinePoint[] {
  const points: TimelinePoint[] = []

  for (const entry of history.slice(0, limit)) {
    for (const response of entry.responses) {
      if (response.status !== 'done') continue
      points.push({
        date: entry.createdAt,
        modelId: response.modelId,
        label: modelLabel(response.modelId),
        latencyMs: response.metrics.latencyMs,
      })
    }
  }

  return points.reverse()
}

export function buildTimelineFromResponses(
  responses: ModelResponse[],
  date: string,
): TimelinePoint[] {
  return responses
    .filter(r => r.status === 'done')
    .map(r => ({
      date,
      modelId: r.modelId,
      label: modelLabel(r.modelId),
      latencyMs: r.metrics.latencyMs,
    }))
}

export function timelineSeries(points: TimelinePoint[]): Map<string, { label: string, values: number[] }> {
  const series = new Map<string, { label: string, values: number[] }>()

  for (const point of points) {
    let bucket = series.get(point.modelId)
    if (!bucket) {
      bucket = { label: point.label, values: [] }
      series.set(point.modelId, bucket)
    }
    bucket.values.push(point.latencyMs)
  }

  return series
}

function average(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}
