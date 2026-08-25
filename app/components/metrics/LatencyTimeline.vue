<script setup lang="ts">
import { colorForIndex, type TimelinePoint } from '~/lib/metrics'

const props = defineProps<{
  points: TimelinePoint[]
}>()

const { formatLatency } = useCostCalculator()

const CHART_W = 600
const CHART_H = 200
const PAD = { top: 16, right: 16, bottom: 28, left: 48 }

const modelIds = computed(() => {
  const ids = [...new Set(props.points.map(p => p.modelId))]
  return ids
})

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

const maxLatency = computed(() => {
  const vals = props.points.map(p => p.latencyMs)
  return Math.max(...vals, 100)
})

function yScale(ms: number): number {
  const innerH = CHART_H - PAD.top - PAD.bottom
  return PAD.top + innerH - (ms / maxLatency.value) * innerH
}

function xScale(runIndex: number): number {
  const innerW = CHART_W - PAD.left - PAD.right
  const total = Math.max(groupedRuns.value.length - 1, 1)
  return PAD.left + (runIndex / total) * innerW
}

const lines = computed(() => {
  return modelIds.value.map((modelId, colorIdx) => {
    const coords: { x: number, y: number }[] = []

    groupedRuns.value.forEach((run, runIdx) => {
      const point = run.find(p => p.modelId === modelId)
      if (point) {
        coords.push({ x: xScale(runIdx), y: yScale(point.latencyMs) })
      }
    })

    return {
      modelId,
      label: props.points.find(p => p.modelId === modelId)?.label ?? modelId,
      color: colorForIndex(colorIdx),
      coords,
      polyline: coords.map(c => `${c.x},${c.y}`).join(' '),
    }
  }).filter(l => l.coords.length > 1)
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
    <p class="text-xs text-muted-foreground mb-4">Recent runs — lower is better</p>

    <div v-if="!points.length" class="text-sm text-muted-foreground py-12 text-center">
      Run comparisons in the Playground to see latency trends.
    </div>

    <div v-else class="overflow-x-auto">
      <svg
        :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
        class="w-full min-w-[320px] max-h-[220px]"
        role="img"
        aria-label="Latency timeline chart"
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

        <polyline
          v-for="line in lines"
          :key="line.modelId"
          :points="line.polyline"
          fill="none"
          :stroke="line.color"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <template v-for="line in lines" :key="`dots-${line.modelId}`">
          <circle
            v-for="(coord, i) in line.coords"
            :key="`${line.modelId}-${i}`"
            :cx="coord.x"
            :cy="coord.y"
            r="3.5"
            :fill="line.color"
          />
        </template>
      </svg>

      <div class="flex flex-wrap gap-3 mt-3">
        <div v-for="(line, i) in lines" :key="line.modelId" class="flex items-center gap-1.5 text-xs">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: line.color }" />
          {{ line.label }}
        </div>
      </div>
    </div>
  </UiCard>
</template>
