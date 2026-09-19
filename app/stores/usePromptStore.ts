// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { defineStore } from 'pinia'
import {
  applyPromptBackupImport,
  exportPromptBackupJson,
  upsertSavedPrompt,
  type PromptBackupMode,
} from '~/lib/promptBackup'
import { parsePromptFile, serializePromptFile } from '~/lib/promptFile'
import { detectVariables, interpolateVariables, syncVariableKeys } from '~/lib/variables'
import type {
  ExecutionHistoryEntry,
  GenerationParams,
  ModelResponse,
  PromptFileData,
  PromptSnapshot,
  PromptVariables,
  ProviderId,
  SavedPrompt,
  AssertionRule,
} from '~/types/llm'
import { createAssertionId } from '~/lib/assertions'
import {
  createToolSignatureId,
  type ToolSignature,
} from '~/lib/toolCall'

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const usePromptStore = defineStore('prompt', {
  state: () => ({
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Explain {{topic}} in simple terms for a {{audience}}.',
    variables: { topic: 'quantum computing', audience: 'beginner' } as PromptVariables,
    responses: [] as ModelResponse[],
    isRunning: false,
    history: [] as ExecutionHistoryEntry[],
    savedPrompts: [] as SavedPrompt[],
    generation: { temperature: 0.7, maxTokens: 4096 } as GenerationParams,
    assertions: [] as AssertionRule[],
    toolSignatures: [] as ToolSignature[],
  }),

  getters: {
    detectedVariables(state): string[] {
      return detectVariables(state.systemPrompt, state.userPrompt)
    },

    promptSnapshots(state): PromptSnapshot[] {
      const snapshots: PromptSnapshot[] = []
      for (const prompt of state.savedPrompts) {
        snapshots.push({
          id: `saved:${prompt.id}:current`,
          label: `${prompt.name} (v${prompt.version})`,
          source: 'saved',
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
          variables: { ...(prompt.variables ?? {}) },
        })
        for (const revision of prompt.revisions ?? []) {
          snapshots.push({
            id: `saved:${prompt.id}:v${revision.version}`,
            label: `${prompt.name} (v${revision.version})`,
            source: 'revision',
            systemPrompt: revision.systemPrompt,
            userPrompt: revision.userPrompt,
            variables: { ...revision.variables },
          })
        }
      }
      for (const entry of state.history) {
        snapshots.push({
          id: `history:${entry.id}`,
          label: `History · ${entry.createdAt}`,
          source: 'history',
          systemPrompt: entry.systemPrompt,
          userPrompt: entry.userPrompt,
          variables: { ...entry.variables },
        })
      }
      return snapshots
    },

    interpolatedSystemPrompt(state): string {
      return interpolateVariables(state.systemPrompt, state.variables)
    },

    interpolatedUserPrompt(state): string {
      return interpolateVariables(state.userPrompt, state.variables)
    },
  },

  actions: {
    setVariable(name: string, value: string) {
      this.variables[name] = value
    },

    syncVariablesFromPrompts() {
      this.variables = syncVariableKeys(this.detectedVariables, this.variables)
    },

    setResponses(responses: ModelResponse[]) {
      this.responses = responses
    },

    updateResponse(slotId: string, patch: Partial<ModelResponse>) {
      const idx = this.responses.findIndex(r => r.slotId === slotId)
      const current = idx === -1 ? undefined : this.responses[idx]
      if (!current) return
      this.responses[idx] = { ...current, ...patch }
    },

    addToHistory(responses: ModelResponse[], models: ExecutionHistoryEntry['models'], assertionSummary?: ExecutionHistoryEntry['assertionSummary']) {
      const entry: ExecutionHistoryEntry = {
        id: createId(),
        systemPrompt: this.systemPrompt,
        userPrompt: this.userPrompt,
        variables: { ...this.variables },
        models,
        responses: JSON.parse(JSON.stringify(responses)),
        createdAt: new Date().toISOString(),
        assertionSummary,
      }
      this.history.unshift(entry)
      if (this.history.length > 100) this.history.pop()
    },

    addAssertion(rule: Omit<AssertionRule, 'id'> & { id?: string }) {
      this.assertions.push({
        enabled: true,
        ...rule,
        id: rule.id ?? createAssertionId(),
      })
    },

    updateAssertion(id: string, patch: Partial<AssertionRule>) {
      const idx = this.assertions.findIndex(a => a.id === id)
      const current = idx === -1 ? undefined : this.assertions[idx]
      if (!current) return
      this.assertions[idx] = { ...current, ...patch }
    },

    removeAssertion(id: string) {
      this.assertions = this.assertions.filter(a => a.id !== id)
    },

    addToolSignature(tool: Omit<ToolSignature, 'id'> & { id?: string }) {
      this.toolSignatures.push({
        ...tool,
        id: tool.id ?? createToolSignatureId(),
        name: tool.name.trim(),
      })
    },

    updateToolSignature(id: string, patch: Partial<ToolSignature>) {
      const idx = this.toolSignatures.findIndex(t => t.id === id)
      const current = idx === -1 ? undefined : this.toolSignatures[idx]
      if (!current) return
      this.toolSignatures[idx] = { ...current, ...patch }
    },

    removeToolSignature(id: string) {
      this.toolSignatures = this.toolSignatures.filter(t => t.id !== id)
    },

    savePrompt(name: string, tags: string[] = [], meta: { model?: string; provider?: ProviderId } = {}) {
      const { savedPrompts, prompt } = upsertSavedPrompt(
        this.savedPrompts,
        {
          systemPrompt: this.systemPrompt,
          userPrompt: this.userPrompt,
          variables: this.variables,
          generation: this.generation,
        },
        name,
        tags,
        meta,
        { createId },
      )
      this.savedPrompts = savedPrompts
      return prompt
    },

    loadPrompt(id: string) {
      const prompt = this.savedPrompts.find(p => p.id === id)
      if (!prompt) return
      this.systemPrompt = prompt.systemPrompt
      this.userPrompt = prompt.userPrompt
      this.variables = { ...(prompt.variables ?? {}) }
      this.generation = { ...(prompt.generation ?? {}) }
      this.syncVariablesFromPrompts()
    },

    loadFromHistory(id: string) {
      const entry = this.history.find(h => h.id === id)
      if (!entry) return
      this.systemPrompt = entry.systemPrompt
      this.userPrompt = entry.userPrompt
      this.variables = { ...entry.variables }
      this.responses = JSON.parse(JSON.stringify(entry.responses))
    },

    deleteSavedPrompt(id: string) {
      this.savedPrompts = this.savedPrompts.filter(p => p.id !== id)
    },

    clearHistory() {
      this.history = []
    },

    exportPromptMarkdown(meta: { name?: string; model?: string; provider?: ProviderId; tags?: string[] } = {}): string {
      return serializePromptFile({
        name: meta.name,
        model: meta.model,
        provider: meta.provider,
        tags: meta.tags,
        generation: Object.keys(this.generation).length ? { ...this.generation } : undefined,
        variables: { ...this.variables },
        systemPrompt: this.systemPrompt,
        userPrompt: this.userPrompt,
      })
    },

    applyPromptFile(data: PromptFileData) {
      this.systemPrompt = data.systemPrompt
      this.userPrompt = data.userPrompt
      this.variables = { ...data.variables }
      this.generation = { ...(data.generation ?? {}) }
      this.syncVariablesFromPrompts()
    },

    importPromptMarkdown(markdown: string): PromptFileData {
      const data = parsePromptFile(markdown)
      this.applyPromptFile(data)
      return data
    },

    exportBackupJson(): string {
      return exportPromptBackupJson(this.history, this.savedPrompts)
    },

    importBackupJson(raw: string, mode: PromptBackupMode): { history: number, savedPrompts: number } {
      const result = applyPromptBackupImport(
        { history: this.history, savedPrompts: this.savedPrompts },
        raw,
        mode,
      )
      this.history = result.history
      this.savedPrompts = result.savedPrompts
      return result.imported
    },
  },

  persist: true,
})
