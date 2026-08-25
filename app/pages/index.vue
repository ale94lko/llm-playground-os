<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { Code2, Play, Save, Square } from '@lucide/vue'
import type { ExportLanguage } from '~/composables/useCodeExporter'
import type { ModelResponse } from '~/types/llm'
import { PROVIDER_MODELS } from '~/stores/useProviderStore'

const promptStore = usePromptStore()
const providerStore = useProviderStore()
const { streamCompletion } = useLLMStream()
const { estimateTokens, calculateCost } = useCostCalculator()
const { exportCode } = useCodeExporter()

const abortControllers = ref<AbortController[]>([])
const showExport = ref(false)
const exportLang = ref<ExportLanguage>('javascript')
const saveName = ref('')
const showSave = ref(false)

const exportSnippet = computed(() => {
  const slot = providerStore.selectedModels[0]
  if (!slot) return ''
  return exportCode(exportLang.value, {
    provider: slot.provider,
    model: slot.modelId,
    systemPrompt: promptStore.interpolatedSystemPrompt,
    userPrompt: promptStore.interpolatedUserPrompt,
    apiKey: providerStore.getApiKey(slot.provider),
    ollamaUrl: providerStore.ollamaUrl,
  })
})

const canRun = computed(() =>
  providerStore.selectedModels.every(s => providerStore.isProviderConfigured(s.provider)),
)

function createEmptyResponse(slotId: string, provider: ModelResponse['provider'], modelId: string): ModelResponse {
  const model = PROVIDER_MODELS.find(m => m.id === modelId)
  const inputText = promptStore.interpolatedSystemPrompt + promptStore.interpolatedUserPrompt
  const inputTokens = estimateTokens(inputText)

  return {
    slotId,
    provider,
    modelId,
    content: '',
    status: 'idle',
    metrics: {
      latencyMs: 0,
      ttftMs: null,
      inputTokens,
      outputTokens: 0,
      costUsd: calculateCost(model, inputTokens, 0),
    },
  }
}

async function runAll() {
  stopAll()
  promptStore.isRunning = true
  abortControllers.value = []

  const initialResponses = providerStore.selectedModels.map(slot =>
    createEmptyResponse(slot.slotId, slot.provider, slot.modelId),
  )
  promptStore.setResponses(initialResponses)

  const promises = providerStore.selectedModels.map(async (slot, index) => {
    const controller = new AbortController()
    abortControllers.value.push(controller)
    const startTime = performance.now()
    let content = ''

    promptStore.updateResponse(slot.slotId, { status: 'streaming' })

    await streamCompletion(
      {
        provider: slot.provider,
        model: slot.modelId,
        systemPrompt: promptStore.interpolatedSystemPrompt,
        userPrompt: promptStore.interpolatedUserPrompt,
        apiKey: providerStore.getApiKey(slot.provider),
        ollamaUrl: providerStore.ollamaUrl,
      },
      {
        onChunk: (text) => {
          content += text
          const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
          const outputTokens = estimateTokens(content)
          const inputTokens = initialResponses[index].metrics.inputTokens
          promptStore.updateResponse(slot.slotId, {
            content,
            metrics: {
              ...initialResponses[index].metrics,
              outputTokens,
              costUsd: calculateCost(model, inputTokens, outputTokens),
              latencyMs: performance.now() - startTime,
            },
          })
        },
        onFirstToken: (ttftMs) => {
          promptStore.updateResponse(slot.slotId, {
            metrics: {
              ...promptStore.responses.find(r => r.slotId === slot.slotId)!.metrics,
              ttftMs,
            },
          })
        },
        onDone: () => {
          const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
          const outputTokens = estimateTokens(content)
          const inputTokens = initialResponses[index].metrics.inputTokens
          promptStore.updateResponse(slot.slotId, {
            status: 'done',
            metrics: {
              ...initialResponses[index].metrics,
              outputTokens,
              costUsd: calculateCost(model, inputTokens, outputTokens),
              latencyMs: performance.now() - startTime,
            },
          })
        },
        onError: (error) => {
          promptStore.updateResponse(slot.slotId, {
            status: 'error',
            error,
            metrics: {
              ...initialResponses[index].metrics,
              latencyMs: performance.now() - startTime,
            },
          })
        },
      },
      controller.signal,
    )
  })

  await Promise.allSettled(promises)
  promptStore.isRunning = false
  promptStore.addToHistory(
    promptStore.responses,
    providerStore.selectedModels.map(s => ({ ...s })),
  )
}

function stopAll() {
  abortControllers.value.forEach(c => c.abort())
  abortControllers.value = []
  promptStore.isRunning = false
}

function handleSave() {
  if (!saveName.value.trim()) return
  promptStore.savePrompt(saveName.value.trim())
  saveName.value = ''
  showSave.value = false
}

async function copyExport() {
  await navigator.clipboard.writeText(exportSnippet.value)
}

const languages: { id: ExportLanguage; label: string }[] = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'curl', label: 'cURL' },
  { id: 'php', label: 'PHP' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Playground</h1>
        <p class="text-sm text-muted-foreground">Compare up to 4 LLM models in parallel</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UiButton variant="outline" size="sm" @click="showSave = true">
          <Save class="h-4 w-4" />
          Save
        </UiButton>
        <UiButton variant="outline" size="sm" @click="showExport = true">
          <Code2 class="h-4 w-4" />
          Export
        </UiButton>
        <UiButton v-if="promptStore.isRunning" variant="destructive" @click="stopAll">
          <Square class="h-4 w-4" />
          Stop
        </UiButton>
        <UiButton :disabled="!canRun || promptStore.isRunning" @click="runAll">
          <Play class="h-4 w-4" />
          Run All
        </UiButton>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="space-y-4">
        <PlaygroundPromptEditor />
        <PlaygroundVariablesInput />
      </div>
      <PlaygroundModelSelector />
    </div>

    <div v-if="promptStore.responses.length">
      <h2 class="text-lg font-semibold mb-3">Responses</h2>
      <PlaygroundComparisonGrid :responses="promptStore.responses" />
    </div>

    <UiDialog :open="showExport" title="Export Code" @close="showExport = false">
      <div class="flex gap-2 mb-4">
        <UiButton
          v-for="lang in languages"
          :key="lang.id"
          :variant="exportLang === lang.id ? 'default' : 'outline'"
          size="sm"
          @click="exportLang = lang.id"
        >
          {{ lang.label }}
        </UiButton>
      </div>
      <pre class="rounded-md bg-muted p-4 text-xs overflow-auto max-h-80 font-mono">{{ exportSnippet }}</pre>
      <div class="flex justify-end gap-2 mt-4">
        <UiButton variant="outline" @click="showExport = false">Close</UiButton>
        <UiButton @click="copyExport">Copy</UiButton>
      </div>
    </UiDialog>

    <UiDialog :open="showSave" title="Save Prompt" @close="showSave = false">
      <UiLabel class="mb-1.5 block">Name</UiLabel>
      <UiInput v-model="saveName" placeholder="My prompt collection" />
      <div class="flex justify-end gap-2 mt-4">
        <UiButton variant="outline" @click="showSave = false">Cancel</UiButton>
        <UiButton @click="handleSave">Save</UiButton>
      </div>
    </UiDialog>
  </div>
</template>
