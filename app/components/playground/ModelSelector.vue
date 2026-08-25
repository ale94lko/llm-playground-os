<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue'
import type { ProviderId } from '~/types/llm'
import { PROVIDER_MODELS } from '~/stores/useProviderStore'

const providerStore = useProviderStore()

const providers: { id: ProviderId; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'groq', label: 'Groq' },
  { id: 'ollama', label: 'Ollama' },
]

function modelsForProvider(provider: ProviderId) {
  return PROVIDER_MODELS.filter(m => m.provider === provider)
}

function onProviderChange(slotId: string, provider: ProviderId) {
  const first = modelsForProvider(provider)[0]
  if (first) providerStore.updateSlot(slotId, provider, first.id)
}
</script>

<template>
  <UiCard class="p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium">Models ({{ providerStore.selectedModels.length }}/4)</h3>
      <UiButton
        v-if="providerStore.selectedModels.length < 4"
        variant="outline"
        size="sm"
        @click="providerStore.addSlot()"
      >
        <Plus class="h-4 w-4" />
        Add
      </UiButton>
    </div>
    <div class="space-y-2">
      <div
        v-for="slot in providerStore.selectedModels"
        :key="slot.slotId"
        class="flex flex-wrap items-center gap-2"
      >
        <select
          :value="slot.provider"
          class="h-9 rounded-md border border-border bg-card px-2 text-sm"
          @change="onProviderChange(slot.slotId, ($event.target as HTMLSelectElement).value as ProviderId)"
        >
          <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.label }}</option>
        </select>
        <select
          :value="slot.modelId"
          class="h-9 flex-1 min-w-[160px] rounded-md border border-border bg-card px-2 text-sm"
          @change="providerStore.updateSlot(slot.slotId, slot.provider, ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="model in modelsForProvider(slot.provider)"
            :key="model.id"
            :value="model.id"
          >
            {{ model.label }}
          </option>
        </select>
        <UiBadge
          :variant="providerStore.isProviderConfigured(slot.provider) ? 'success' : 'warning'"
        >
          {{ providerStore.isProviderConfigured(slot.provider) ? 'Ready' : 'No key' }}
        </UiBadge>
        <UiButton
          v-if="providerStore.selectedModels.length > 1"
          variant="ghost"
          size="sm"
          @click="providerStore.removeSlot(slot.slotId)"
        >
          <Trash2 class="h-4 w-4" />
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>
