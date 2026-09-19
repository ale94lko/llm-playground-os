// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import {
  applyColumnMapping,
  truncatePreview,
  type BulkCaseResult,
  type BulkModelResult,
  type ColumnMapping,
} from '~/lib/dataset'
import { markInFlightAsCancelled, shouldPersistRunHistory } from '~/lib/runHistory'
import { evaluateAssertions, summarizeResponses } from '~/lib/assertions'
import { buildToolFollowUpMessages, flattenMessagesForLegacyPrompt } from '~/lib/toolCall'
import { PROVIDER_MODELS } from '~/lib/providerModels'
import { buildMetrics, createInitialMetrics } from '~/lib/streamMetrics'
import { interpolateVariables } from '~/lib/variables'
import type { ModelResponse, PromptVariables } from '~/types/llm'

export function useCompareRunner() {
  const promptStore = usePromptStore()
  const providerStore = useProviderStore()
  const { streamCompletion } = useLLMStream()
  const { estimateTokens, calculateCost } = useCostCalculator()

  const abortControllers = ref<AbortController[]>([])
  const bulkResults = ref<BulkCaseResult[]>([])
  const bulkProgress = ref('')
  const bulkCancelled = ref(false)

  const canRun = computed(() =>
    providerStore.selectedModels.every(s => providerStore.isProviderConfigured(s.provider)),
  )

  function clearBulkResults() {
    bulkResults.value = []
    bulkProgress.value = ''
  }

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
      metrics: createInitialMetrics(inputTokens, calculateCost(model, inputTokens, 0)),
    }
  }

  async function runSlotStream(
    slot: { slotId: string, provider: ModelResponse['provider'], modelId: string },
    prompts: { systemPrompt: string, userPrompt: string },
    options?: {
      onUpdate?: (partial: Partial<ModelResponse> & { content?: string }) => void
      updateStore?: boolean
    },
  ): Promise<{ content: string, status: ModelResponse['status'], latencyMs: number, error?: string }> {
    const controller = new AbortController()
    abortControllers.value.push(controller)
    const startTime = performance.now()
    let content = ''
    let status: ModelResponse['status'] = 'streaming'
    let errorMessage: string | undefined
    const inputTokens = estimateTokens(prompts.systemPrompt + prompts.userPrompt)
    const baseMetrics = createInitialMetrics(
      inputTokens,
      calculateCost(PROVIDER_MODELS.find(m => m.id === slot.modelId), inputTokens, 0),
    )

    if (options?.updateStore !== false) {
      promptStore.updateResponse(slot.slotId, { status: 'streaming' })
    }

    await streamCompletion(
      {
        provider: slot.provider,
        model: slot.modelId,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        apiKey: providerStore.getApiKey(slot.provider),
        ollamaUrl: providerStore.ollamaUrl,
        lmStudioUrl: providerStore.lmStudioUrl,
        temperature: promptStore.generation.temperature,
        maxTokens: promptStore.generation.maxTokens,
      },
      {
        onChunk: (text) => {
          content += text
          const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
          const outputTokens = estimateTokens(content)
          const metrics = buildMetrics(baseMetrics, {
            outputTokens,
            costUsd: calculateCost(model, inputTokens, outputTokens),
            latencyMs: performance.now() - startTime,
          })
          options?.onUpdate?.({ content, metrics })
          if (options?.updateStore !== false) {
            promptStore.updateResponse(slot.slotId, { content, metrics })
          }
        },
        onFirstToken: (ttftMs) => {
          baseMetrics.ttftMs = ttftMs
          if (options?.updateStore !== false) {
            const current = promptStore.responses.find(r => r.slotId === slot.slotId)
            if (!current) return
            promptStore.updateResponse(slot.slotId, {
              metrics: buildMetrics(current.metrics, { ttftMs }),
            })
          }
        },
        onDone: () => {
          status = 'done'
          const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
          const outputTokens = estimateTokens(content)
          const metrics = buildMetrics(baseMetrics, {
            outputTokens,
            costUsd: calculateCost(model, inputTokens, outputTokens),
            latencyMs: performance.now() - startTime,
          })
          if (options?.updateStore !== false) {
            promptStore.updateResponse(slot.slotId, { status: 'done', metrics })
          }
        },
        onError: (error) => {
          status = 'error'
          errorMessage = error.message
          const metrics = buildMetrics(baseMetrics, {
            latencyMs: performance.now() - startTime,
          })
          if (options?.updateStore !== false) {
            promptStore.updateResponse(slot.slotId, {
              status: 'error',
              error: error.message,
              metrics,
            })
          }
        },
      },
      controller.signal,
    )

    if (controller.signal.aborted && (status === 'streaming' || status === 'idle')) {
      status = 'cancelled'
      const metrics = buildMetrics(baseMetrics, {
        outputTokens: estimateTokens(content),
        latencyMs: performance.now() - startTime,
      })
      if (options?.updateStore !== false) {
        promptStore.updateResponse(slot.slotId, {
          status: 'cancelled',
          content,
          metrics,
        })
      }
    }

    return {
      content,
      status,
      latencyMs: performance.now() - startTime,
      error: errorMessage,
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

    const prompts = {
      systemPrompt: promptStore.interpolatedSystemPrompt,
      userPrompt: promptStore.interpolatedUserPrompt,
    }

    await Promise.allSettled(
      providerStore.selectedModels.map(slot => runSlotStream(slot, prompts)),
    )

    promptStore.setResponses(markInFlightAsCancelled(promptStore.responses))

    if (promptStore.assertions.length) {
      for (const response of promptStore.responses) {
        if (response.status !== 'done') continue
        promptStore.updateResponse(response.slotId, {
          assertionResults: evaluateAssertions(promptStore.assertions, response.content),
        })
      }
    }

    promptStore.isRunning = false

    if (shouldPersistRunHistory(promptStore.responses)) {
      promptStore.addToHistory(
        promptStore.responses,
        providerStore.selectedModels.map(s => ({ ...s })),
        summarizeResponses(promptStore.responses),
      )
    }
  }

  async function continueWithTool(payload: {
    slotId: string
    toolName: string
    mockResultJson: string
    assistantContent: string
  }) {
    const slot = providerStore.selectedModels.find(s => s.slotId === payload.slotId)
    if (!slot || promptStore.isRunning) return

    const messages = buildToolFollowUpMessages({
      systemPrompt: promptStore.interpolatedSystemPrompt,
      userPrompt: promptStore.interpolatedUserPrompt,
      assistantContent: payload.assistantContent,
      toolName: payload.toolName,
      mockResultJson: payload.mockResultJson,
    })
    const prompts = flattenMessagesForLegacyPrompt(messages)

    promptStore.isRunning = true
    abortControllers.value = []
    await runSlotStream(slot, prompts)
    promptStore.setResponses(markInFlightAsCancelled(promptStore.responses))

    if (promptStore.assertions.length) {
      const response = promptStore.responses.find(r => r.slotId === slot.slotId)
      if (response?.status === 'done') {
        promptStore.updateResponse(response.slotId, {
          assertionResults: evaluateAssertions(promptStore.assertions, response.content),
        })
      }
    }

    promptStore.isRunning = false
  }

  async function runBulkDataset(payload: { rows: Record<string, string>[], mapping: ColumnMapping }) {
    stopAll()
    bulkCancelled.value = false
    promptStore.isRunning = true
    abortControllers.value = []
    bulkResults.value = payload.rows.map((row, index) => ({
      index,
      variables: applyColumnMapping(row, payload.mapping, { ...promptStore.variables }),
      status: 'pending',
      models: [],
    }))

    for (let i = 0; i < payload.rows.length; i++) {
      if (bulkCancelled.value) {
        for (let j = i; j < bulkResults.value.length; j++) {
          const pending = bulkResults.value[j]
          if (pending) pending.status = 'cancelled'
        }
        break
      }

      const caseResult = bulkResults.value[i]
      if (!caseResult) continue
      caseResult.status = 'running'
      bulkProgress.value = `Running row ${i + 1} of ${payload.rows.length}`

      const vars: PromptVariables = caseResult.variables
      const prompts = {
        systemPrompt: interpolateVariables(promptStore.systemPrompt, vars),
        userPrompt: interpolateVariables(promptStore.userPrompt, vars),
      }

      const modelResults = await Promise.all(
        providerStore.selectedModels.map(async (slot): Promise<BulkModelResult> => {
          const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
          const result = await runSlotStream(slot, prompts, { updateStore: false })
          const aborted = bulkCancelled.value || result.status === 'cancelled' || result.status === 'streaming' || result.status === 'idle'
          return {
            modelId: slot.modelId,
            label: model?.label ?? slot.modelId,
            status: result.status === 'done'
              ? 'done'
              : result.status === 'cancelled'
                ? 'cancelled'
                : 'error',
            latencyMs: result.latencyMs,
            outputPreview: truncatePreview(result.content),
            error: result.error ?? (aborted ? 'Cancelled' : undefined),
          }
        }),
      )

      caseResult.models = modelResults
      caseResult.status = bulkCancelled.value
        ? 'cancelled'
        : modelResults.some(m => m.status === 'error')
          ? 'error'
          : 'done'
    }

    bulkProgress.value = bulkCancelled.value
      ? 'Bulk run stopped'
      : `Finished ${bulkResults.value.filter(r => r.status === 'done' || r.status === 'error').length} rows`
    promptStore.isRunning = false
  }

  function stopAll() {
    bulkCancelled.value = true
    abortControllers.value.forEach(c => c.abort())
    abortControllers.value = []
    if (promptStore.responses.some(r => r.status === 'streaming' || r.status === 'idle')) {
      promptStore.setResponses(markInFlightAsCancelled(promptStore.responses))
    }
    promptStore.isRunning = false
  }

  return {
    bulkResults,
    bulkProgress,
    canRun,
    runAll,
    continueWithTool,
    runBulkDataset,
    stopAll,
    clearBulkResults,
  }
}
