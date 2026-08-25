<script setup lang="ts">
import { Check, Copy, Loader2 } from '@lucide/vue'
import type { ModelResponse } from '~/types/llm'
import { PROVIDER_MODELS } from '~/stores/useProviderStore'

const props = defineProps<{ response: ModelResponse }>()

const { formatCost, formatLatency } = useCostCalculator()

const model = computed(() => PROVIDER_MODELS.find(m => m.id === props.response.modelId))
const copied = ref(false)

async function copyResponse() {
  await navigator.clipboard.writeText(props.response.content)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

const statusVariant = computed(() => {
  switch (props.response.status) {
    case 'streaming': return 'warning' as const
    case 'done': return 'success' as const
    case 'error': return 'error' as const
    default: return 'secondary' as const
  }
})
</script>

<template>
  <UiCard class="flex flex-col h-full min-h-[280px] overflow-hidden">
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-medium text-sm truncate">{{ model?.label ?? response.modelId }}</span>
        <UiBadge :variant="statusVariant">{{ response.status }}</UiBadge>
      </div>
      <UiButton variant="ghost" size="sm" :disabled="!response.content" @click="copyResponse">
        <Check v-if="copied" class="h-4 w-4 text-emerald-400" />
        <Copy v-else class="h-4 w-4" />
      </UiButton>
    </div>

    <div class="flex flex-wrap gap-2 px-4 py-2 border-b border-border bg-muted/30">
      <UiBadge variant="secondary">{{ formatLatency(response.metrics.latencyMs) }}</UiBadge>
      <UiBadge v-if="response.metrics.ttftMs" variant="secondary">
        TTFT {{ formatLatency(response.metrics.ttftMs) }}
      </UiBadge>
      <UiBadge variant="secondary">In {{ response.metrics.inputTokens }}</UiBadge>
      <UiBadge variant="secondary">Out {{ response.metrics.outputTokens }}</UiBadge>
      <UiBadge variant="secondary">{{ formatCost(response.metrics.costUsd) }}</UiBadge>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <div v-if="response.status === 'streaming' && !response.content" class="flex items-center gap-2 text-muted-foreground">
        <Loader2 class="h-4 w-4 animate-spin" />
        <span class="text-sm">Waiting for first token...</span>
      </div>
      <p v-else-if="response.error" class="text-sm text-red-400">{{ response.error }}</p>
      <pre v-else class="whitespace-pre-wrap text-sm font-mono leading-relaxed">{{ response.content }}<span v-if="response.status === 'streaming'" class="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" /></pre>
    </div>
  </UiCard>
</template>
