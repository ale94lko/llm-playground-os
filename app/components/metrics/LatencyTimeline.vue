<script setup lang="ts">
import { colorForIndex, type TimelinePoint } from '~/lib/metrics'

const props = defineProps<{
  points: TimelinePoint[]
}>()

const { formatLatency } = useCostCalculator()

const CHART_W = 600
const CHART_H = 220
const PAD = { top: 16, right: 16, bottom: 40, left: 48 }

const modelIds = computed(() => [...new Set(props.points.map(p => p.modelId))])

const groupedRuns = computed(() => {
  const runs: TimelinePoint[][] = []
  let currentDate = ''
  let current: TimelinePoint[] = []

  for (const point of props.points) {
    if (point.date !== currentDate) {
      if (current.length) runs.push(current)
      current = [point]
      currentDate = point.date
    }
    else {
      current.push(point)
    }
  }
  if (current.length) runs.push(current)
  return runs
})

/** One run snapshot → bar comparison; multiple runs → line timeline */
const isComparisonMode = computed(() => groupedRuns.value.length <= 1)

const maxLatency = computed(() => {
  const vals = props.points.map(p => p.latencyMs)
  return Math.max(...vals, 100)
})

const baselineY = computed(() => CHART_H - PAD.bottom)

function yScale(ms: number): number {
  const innerH = CHART_H - PAD.top - PAD.bottom
  return PAD.top + innerH - (ms / maxLatency.value) * innerH
}

function xScaleRun(runIndex: number, totalRuns: number): number {
  const innerW = CHART_W - PAD.left - PAD.right
  if (totalRuns <= 1) return PAD.left + innerW / 2
  return PAD.left + (runIndex / (totalRuns - 1)) * innerW
}

function formatRunLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function truncateLabel(label: string, max = 14): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label
}

const comparisonBars = computed(() => {
  if (!isComparisonMode.value) return []

  const run = [...(groupedRuns.value[0] ?? [])].sort((a, b) => a.latencyMs - b.latencyMs)
  const innerW = CHART_W - PAD.left - PAD.right
  const slotW = innerW / Math.max(run.length, 1)
  const barW = Math.min(56, slotW * 0.55)

  return run.map((point, i) => {
    const colorIdx = modelIds.value.indexOf(point.modelId)
    const x = PAD.left + slotW * i + slotW / 2
    const y = yScale(point.latencyMs)
    return {
      modelId: point.modelId,
      label: point.label,
      color: colorForIndex(colorIdx >= 0 ? colorIdx : i),
      x,
      y,
      barW,
      height: baselineY.value - y,
      latencyMs: point.latencyMs,
    }
  })
})

const timelineLines = computed(() => {
  if (isComparisonMode.value) return []

  const totalRuns = groupedRuns.value.length
  return modelIds.value.map((modelId, colorIdx) => {
    const coords: { x: number, y: number }[] = []

    groupedRuns.value.forEach((run, runIdx) => {
      const point = run.find(p => p.modelId === modelId)
      if (point) {
        coords.push({ x: xScaleRun(runIdx, totalRuns), y: yScale(point.latencyMs) })
      }
    })

    return {
      modelId,
      label: props.points.find(p => p.modelId === modelId)?.label ?? modelId,
      color: colorForIndex(colorIdx),
      coords,
      polyline: coords.length > 1 ? coords.map(c => `${c.x},${c.y}`).join(' ') : '',
    }
  }).filter(l => l.coords.length > 0)
})

const xTicks = computed(() => {
  if (isComparisonMode.value) {
    return comparisonBars.value.map(bar => ({
      x: bar.x,
      label: truncateLabel(bar.label),
    }))
  }

  return groupedRuns.value.map((run, i) => ({
    x: xScaleRun(i, groupedRuns.value.length),
    label: formatRunLabel(run[0]?.date ?? ''),
  }))
})

const yTicks = computed(() => {
  const steps = 4
  return Array.from({ length: steps + 1 }, (_, i) => {
    const ms = (maxLatency.value / steps) * i
    return { ms, y: yScale(ms), label: formatLatency(ms) }
  })
})
</script>

<template>
  <UiCard class="p-4">
    <h3 class="text-sm font-medium mb-2">Latency over time</h3>
    <p class="text-xs text-muted-foreground mb-4">
      {{ isComparisonMode ? 'Current run — lower is better' : 'Recent runs — lower is better' }}
    </p>

    <div v-if="!points.length" class="text-sm text-muted-foreground py-12 text-center">
      Run comparisons in the Playground to see latency trends.
    </div>

    <div v-else class="overflow-x-auto">
      <svg
        :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
        class="w-full min-w-[320px] max-h-[240px]"
        role="img"
        aria-label="Latency chart"
      >
        <line
          v-for="tick in yTicks"
          :key="tick.ms"
          :x1="PAD.left"
          :x2="CHART_W - PAD.right"
          :y1="tick.y"
          :y2="tick.y"
          stroke="currentColor"
          stroke-opacity="0.1"
        />
        <text
          v-for="tick in yTicks"
          :key="`label-${tick.ms}`"
          :x="PAD.left - 6"
          :y="tick.y + 4"
          text-anchor="end"
          class="fill-muted-foreground text-[10px]"
        >
          {{ tick.label }}
        </text>

        <!-- Single-run comparison: vertical bars per model -->
        <template v-if="isComparisonMode">
          <rect
            v-for="bar in comparisonBars"
            :key="bar.modelId"
            :x="bar.x - bar.barW / 2"
            :y="bar.y"
            :width="bar.barW"
            :height="bar.height"
            :fill="bar.color"
            fill-opacity="0.85"
            rx="3"
          />
          <text
            v-for="bar in comparisonBars"
            :key="`value-${bar.modelId}`"
            :x="bar.x"
            :y="bar.y - 6"
            text-anchor="middle"
            class="fill-foreground text-[10px] font-medium"
          >
            {{ formatLatency(bar.latencyMs) }}
          </text>
        </template>

        <!-- Multi-run timeline: lines + dots -->
        <template v-else>
          <polyline
            v-for="line in timelineLines"
            v-show="line.coords.length > 1"
            :key="line.modelId"
            :points="line.polyline"
            fill="none"
            :stroke="line.color"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          <template v-for="line in timelineLines" :key="`dots-${line.modelId}`">
            <circle
              v-for="(coord, i) in line.coords"
              :key="`${line.modelId}-${i}`"
              :cx="coord.x"
              :cy="coord.y"
              r="4"
              :fill="line.color"
            />
          </template>
        </template>

        <!-- X-axis labels -->
        <text
          v-for="(tick, i) in xTicks"
          :key="`x-${i}`"
          :x="tick.x"
          :y="CHART_H - 8"
          text-anchor="middle"
          class="fill-muted-foreground text-[10px]"
        >
          {{ tick.label }}
        </text>
      </svg>

      <div class="flex flex-wrap gap-3 mt-3">
        <div
          v-for="(modelId, i) in modelIds"
          :key="modelId"
          class="flex items-center gap-1.5 text-xs"
        >
          <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: colorForIndex(i) }" />
          {{ points.find(p => p.modelId === modelId)?.label ?? modelId }}
        </div>
      </div>
    </div>
  </UiCard>
</template>
