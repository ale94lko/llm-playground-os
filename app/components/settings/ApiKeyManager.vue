<script setup lang="ts">
import { Eye, EyeOff, Key } from '@lucide/vue'
import type { ProviderId } from '~/types/llm'

const providerStore = useProviderStore()

const providers: { id: ProviderId; label: string; placeholder: string; isUrl?: boolean }[] = [
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'gemini', label: 'Google Gemini', placeholder: 'AIza...' },
  { id: 'groq', label: 'Groq', placeholder: 'gsk_...' },
  { id: 'ollama', label: 'Ollama URL', placeholder: 'http://localhost:11434', isUrl: true },
]

const visible = ref<Record<string, boolean>>({})
</script>

<template>
  <div class="space-y-4">
    <UiCard class="p-4 border-primary/20 bg-primary/5">
      <div class="flex items-start gap-3">
        <Key class="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p class="text-sm font-medium">Local-first storage</p>
          <p class="text-xs text-muted-foreground mt-1">
            API keys are stored only in your browser (localStorage). They are sent to our server proxy solely to forward requests — never persisted server-side.
          </p>
        </div>
      </div>
    </UiCard>

    <div class="grid gap-4 md:grid-cols-2">
      <div v-for="provider in providers" :key="provider.id">
        <UiLabel class="mb-1.5 block">{{ provider.label }}</UiLabel>
        <div class="relative">
          <UiInput
            :model-value="providerStore.getApiKey(provider.id)"
            :type="provider.isUrl || visible[provider.id] ? 'text' : 'password'"
            :placeholder="provider.placeholder"
            @update:model-value="providerStore.setApiKey(provider.id, $event)"
          />
          <button
            v-if="!provider.isUrl"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            @click="visible[provider.id] = !visible[provider.id]"
          >
            <EyeOff v-if="visible[provider.id]" class="h-4 w-4" />
            <Eye v-else class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
