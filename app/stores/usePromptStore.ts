import { defineStore } from 'pinia'
import { detectVariables, interpolateVariables, syncVariableKeys } from '~/lib/variables'
import type { ExecutionHistoryEntry, ModelResponse, PromptVariables, SavedPrompt } from '~/types/llm'

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
  }),

  getters: {
    detectedVariables(state): string[] {
      return detectVariables(state.systemPrompt, state.userPrompt)
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
      if (idx !== -1) {
        this.responses[idx] = { ...this.responses[idx], ...patch }
      }
    },

    addToHistory(responses: ModelResponse[], models: ExecutionHistoryEntry['models']) {
      const entry: ExecutionHistoryEntry = {
        id: createId(),
        systemPrompt: this.systemPrompt,
        userPrompt: this.userPrompt,
        variables: { ...this.variables },
        models,
        responses: JSON.parse(JSON.stringify(responses)),
        createdAt: new Date().toISOString(),
      }
      this.history.unshift(entry)
      if (this.history.length > 100) this.history.pop()
    },

    savePrompt(name: string, tags: string[] = []) {
      const existing = this.savedPrompts.find(p => p.name === name)
      const now = new Date().toISOString()

      if (existing) {
        existing.systemPrompt = this.systemPrompt
        existing.userPrompt = this.userPrompt
        existing.tags = tags
        existing.version += 1
        existing.updatedAt = now
        return existing
      }

      const prompt: SavedPrompt = {
        id: createId(),
        name,
        systemPrompt: this.systemPrompt,
        userPrompt: this.userPrompt,
        tags,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }
      this.savedPrompts.unshift(prompt)
      return prompt
    },

    loadPrompt(id: string) {
      const prompt = this.savedPrompts.find(p => p.id === id)
      if (!prompt) return
      this.systemPrompt = prompt.systemPrompt
      this.userPrompt = prompt.userPrompt
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
  },

  persist: true,
})
