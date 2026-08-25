<script setup lang="ts">
import type { ChartDatum } from '~/lib/metrics'

defineProps<{
  title: string
  unit?: string
  items: ChartDatum[]
  emptyMessage?: string
}>()
</script>

<template>
  <UiCard class="p-4 h-full">
    <h3 class="text-sm font-medium mb-4">{{ title }}</h3>
    <div v-if="!items.length" class="text-sm text-muted-foreground py-8 text-center">
      {{ emptyMessage ?? 'No data yet' }}
    </div>
    <div v-else class="space-y-3">
      <div v-for="item in items" :key="item.label" class="space-y-1.5">
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="truncate font-medium">{{ item.label }}</span>
          <span class="text-muted-foreground shrink-0">{{ item.sublabel }}{{ unit ? ` ${unit}` : '' }}</span>
        </div>
        <div class="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{ width: `${item.percent}%`, backgroundColor: item.color ?? 'var(--color-primary)' }"
          />
        </div>
      </div>
    </div>
  </UiCard>
</template>
