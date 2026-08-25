<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { Activity, DollarSign, Timer, Zap } from '@lucide/vue'
import {
  aggregateFromHistory,
  aggregateFromResponses,
  buildLatencyTimeline,
  buildTimelineFromResponses,
  toChartData,
  type ModelMetricAggregate,
} from '~/lib/metrics'

const promptStore = usePromptStore()
const { formatCost, formatLatency } = useCostCalculator()

const view = ref<'latest' | 'historical'>('latest')

const latestAggregates = computed(() =>
  aggregateFromResponses(promptStore.responses),
)

const historicalAggregates = computed(() =>
  aggregateFromHistory(promptStore.history),
)

const activeAggregates = computed<ModelMetricAggregate[]>(() =>
  view.value === 'latest' ? latestAggregates.value : historicalAggregates.value,
)

const timelinePoints = computed(() => {
  if (view.value === 'latest') {
    const latest = promptStore.history[0]
    if (latest) return buildLatencyTimeline([latest])
    return buildTimelineFromResponses(
      promptStore.responses,
      new Date().toISOString(),
    )
  }
  return buildLatencyTimeline(promptStore.history)
})

const comparisonSubtitle = computed(() =>
  view.value === 'latest'
    ? 'Results from the most recent run'
    : 'Historical averages across all runs',
)

const summaryCards = computed(() => {
  const data = activeAggregates.value
  if (!data.length) return []

  const fastest = [...data].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0]
  const cheapest = [...data].sort((a, b) => a.avgCostUsd - b.avgCostUsd)[0]
  const totalRuns = view.value === 'latest' ? 1 : promptStore.history.length
  const totalCost = data.reduce((s, d) => s + d.totalCostUsd, 0)

  return [
    { icon: Zap, label: 'Fastest avg', value: fastest?.label ?? '—', sub: fastest ? formatLatency(fastest.avgLatencyMs) : '' },
    { icon: DollarSign, label: 'Cheapest avg', value: cheapest?.label ?? '—', sub: cheapest ? formatCost(cheapest.avgCostUsd) : '' },
    { icon: Activity, label: 'Total runs', value: String(totalRuns), sub: 'executions' },
    { icon: Timer, label: 'Total spent', value: formatCost(totalCost), sub: 'estimated' },
  ]
})

const latencyChart = computed(() =>
  toChartData(activeAggregates.value, a => a.avgLatencyMs, v => formatLatency(v)),
)

const ttftChart = computed(() =>
  toChartData(
    activeAggregates.value.filter(a => a.avgTtftMs != null),
    a => a.avgTtftMs!,
    v => formatLatency(v),
  ),
)

const outputTokensChart = computed(() =>
  toChartData(activeAggregates.value, a => a.avgOutputTokens, v => String(Math.round(v))),
)

const costChart = computed(() =>
  toChartData(activeAggregates.value, a => a.avgCostUsd, v => formatCost(v)),
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Metrics</h1>
        <p class="text-sm text-muted-foreground">Compare model performance across runs</p>
      </div>
      <div class="flex gap-2">
        <UiButton
          :variant="view === 'latest' ? 'default' : 'outline'"
          size="sm"
          @click="view = 'latest'"
        >
          Latest run
        </UiButton>
        <UiButton
          :variant="view === 'historical' ? 'default' : 'outline'"
          size="sm"
          @click="view = 'historical'"
        >
          Historical avg
        </UiButton>
      </div>
    </div>

    <div v-if="summaryCards.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <UiCard v-for="card in summaryCards" :key="card.label" class="p-4">
        <div class="flex items-start gap-3">
          <component :is="card.icon" class="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p class="text-xs text-muted-foreground">{{ card.label }}</p>
            <p class="text-sm font-semibold mt-0.5 truncate">{{ card.value }}</p>
            <p class="text-xs text-muted-foreground">{{ card.sub }}</p>
          </div>
        </div>
      </UiCard>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <MetricsMetricBarChart
        title="Latency"
        :items="latencyChart"
        empty-message="No latency data. Run models from the Playground."
      />
      <MetricsMetricBarChart
        title="Time to first token (TTFT)"
        :items="ttftChart"
        empty-message="TTFT data appears after streaming responses."
      />
      <MetricsMetricBarChart
        title="Output tokens"
        :items="outputTokensChart"
        empty-message="No token data available."
      />
      <MetricsMetricBarChart
        title="Estimated cost"
        :items="costChart"
        empty-message="No cost data available."
      />
    </div>

    <MetricsLatencyTimeline :points="timelinePoints" />

    <UiCard v-if="activeAggregates.length" class="overflow-hidden">
      <div class="p-4 border-b border-border">
        <h3 class="text-sm font-medium">Detailed comparison</h3>
        <p class="text-xs text-muted-foreground mt-0.5">{{ comparisonSubtitle }}</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
              <th class="px-4 py-2 font-medium">Model</th>
              <th class="px-4 py-2 font-medium">Runs</th>
              <th class="px-4 py-2 font-medium">Latency</th>
              <th class="px-4 py-2 font-medium">TTFT</th>
              <th class="px-4 py-2 font-medium">In tokens</th>
              <th class="px-4 py-2 font-medium">Out tokens</th>
              <th class="px-4 py-2 font-medium">Avg cost</th>
              <th class="px-4 py-2 font-medium">Success</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in activeAggregates"
              :key="row.modelId"
              class="border-b border-border last:border-0"
            >
              <td class="px-4 py-2.5 font-medium">{{ row.label }}</td>
              <td class="px-4 py-2.5 text-muted-foreground">{{ row.runs }}</td>
              <td class="px-4 py-2.5">{{ formatLatency(row.avgLatencyMs) }}</td>
              <td class="px-4 py-2.5">{{ row.avgTtftMs != null ? formatLatency(row.avgTtftMs) : '—' }}</td>
              <td class="px-4 py-2.5">{{ Math.round(row.avgInputTokens) }}</td>
              <td class="px-4 py-2.5">{{ Math.round(row.avgOutputTokens) }}</td>
              <td class="px-4 py-2.5">{{ formatCost(row.avgCostUsd) }}</td>
              <td class="px-4 py-2.5">
                <UiBadge :variant="row.successCount === row.runs ? 'success' : 'warning'">
                  {{ row.successCount }}/{{ row.runs }}
                </UiBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <div
      v-if="!activeAggregates.length && !timelinePoints.length"
      class="text-center py-16 text-muted-foreground"
    >
      <p class="text-sm">No metrics yet.</p>
      <p class="text-xs mt-1">Run a comparison in the Playground to populate charts.</p>
      <UiButton class="mt-4" size="sm" @click="navigateTo('/')">
        Go to Playground
      </UiButton>
    </div>
  </div>
</template>
