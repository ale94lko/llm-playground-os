import { defineStore } from 'pinia'
import type { ProviderId, ProviderModel, SelectedModel } from '~/types/llm'
import {
  decryptJson,
  encryptJson,
  type ApiKeysPayload,
  type EncryptedPayload,
} from '~/lib/crypto'
import { DEPRECATED_MODEL_MAP, migrateModelId, PROVIDER_MODELS } from '~/lib/providerModels'
import { sessionStore } from '~/lib/sessionStore'

export { DEPRECATED_MODEL_MAP, PROVIDER_MODELS }

const DEFAULT_SLOTS: SelectedModel[] = [
  { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
  { slotId: 'slot-2', provider: 'ollama', modelId: 'llama3.2' },
]

const LEGACY_STORAGE_KEY = 'provider'

export const useProviderStore = defineStore('provider', {
  state: () => ({
    encryptedPayload: null as EncryptedPayload | null,
    ollamaUrl: 'http://localhost:11434',
    selectedModels: DEFAULT_SLOTS as SelectedModel[],
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
    groqKey: '',
  }),

  getters: {
    modelsByProvider: () => {
      return PROVIDER_MODELS.reduce<Record<ProviderId, ProviderModel[]>>((acc, model) => {
        if (!acc[model.provider]) acc[model.provider] = []
        acc[model.provider].push(model)
        return acc
      }, {} as Record<ProviderId, ProviderModel[]>)
    },

    getModel(): (modelId: string) => ProviderModel | undefined {
      return (modelId: string) => PROVIDER_MODELS.find(m => m.id === modelId)
    },

    isProviderConfigured(): (provider: ProviderId) => boolean {
      return (provider: ProviderId) => {
        switch (provider) {
          case 'openai': return !!this.openaiKey
          case 'anthropic': return !!this.anthropicKey
          case 'gemini': return !!this.geminiKey
          case 'groq': return !!this.groqKey
          case 'ollama': return !!this.ollamaUrl
          default: return false
        }
      }
    },

    hasStoredEncryptedKeys(state): boolean {
      return !!state.encryptedPayload
    },

    keysPayload(state): ApiKeysPayload {
      return {
        openaiKey: state.openaiKey,
        anthropicKey: state.anthropicKey,
        geminiKey: state.geminiKey,
        groqKey: state.groqKey,
      }
    },
  },

  actions: {
    applyKeys(payload: ApiKeysPayload) {
      this.openaiKey = payload.openaiKey
      this.anthropicKey = payload.anthropicKey
      this.geminiKey = payload.geminiKey
      this.groqKey = payload.groqKey
    },

    clearDecryptedKeys() {
      this.applyKeys({ openaiKey: '', anthropicKey: '', geminiKey: '', groqKey: '' })
    },

    async encryptAndPersistKeys() {
      const security = useSecurityStore()
      const key = security.getCryptoKey()
      if (!key) return
      this.encryptedPayload = await encryptJson(key, this.keysPayload)
    },

    async decryptKeys(cryptoKey: CryptoKey) {
      if (!this.encryptedPayload) return
      const keys = await decryptJson<ApiKeysPayload>(cryptoKey, this.encryptedPayload)
      this.applyKeys(keys)
    },

    setApiKey(provider: ProviderId, value: string) {
      const keyMap: Record<ProviderId, keyof ApiKeysPayload | 'ollamaUrl'> = {
        openai: 'openaiKey',
        anthropic: 'anthropicKey',
        gemini: 'geminiKey',
        groq: 'groqKey',
        ollama: 'ollamaUrl',
      }
      const field = keyMap[provider]
      if (field === 'ollamaUrl') {
        this.ollamaUrl = value
        return
      }
      if (field) (this as Record<string, string>)[field] = value

      const security = useSecurityStore()
      if (security.getCryptoKey()) {
        void this.encryptAndPersistKeys()
      }
    },

    getApiKey(provider: ProviderId): string {
      switch (provider) {
        case 'openai': return this.openaiKey
        case 'anthropic': return this.anthropicKey
        case 'gemini': return this.geminiKey
        case 'groq': return this.groqKey
        case 'ollama': return this.ollamaUrl
        default: return ''
      }
    },

    migrateLegacyStorage() {
      if (typeof localStorage === 'undefined') return

      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (!raw) return

        const parsed = JSON.parse(raw) as Record<string, unknown>
        const legacy = (parsed.state ?? parsed) as Record<string, string>

        if (this.encryptedPayload) return
        if (!legacy.openaiKey && !legacy.anthropicKey && !legacy.geminiKey && !legacy.groqKey) return

        this.applyKeys({
          openaiKey: legacy.openaiKey ?? '',
          anthropicKey: legacy.anthropicKey ?? '',
          geminiKey: legacy.geminiKey ?? '',
          groqKey: legacy.groqKey ?? '',
        })
        if (legacy.ollamaUrl) this.ollamaUrl = legacy.ollamaUrl
      }
      catch {
        // ignore corrupt legacy data
      }
    },

    migrateDeprecatedModels() {
      for (const slot of this.selectedModels) {
        slot.modelId = migrateModelId(slot.modelId)
      }
    },

    updateSlot(slotId: string, provider: ProviderId, modelId: string) {
      const slot = this.selectedModels.find(s => s.slotId === slotId)
      if (slot) {
        slot.provider = provider
        slot.modelId = modelId
      }
    },

    addSlot() {
      if (this.selectedModels.length >= 4) return
      const id = `slot-${Date.now()}`
      this.selectedModels.push({ slotId: id, provider: 'openai', modelId: 'gpt-4o-mini' })
    },

    removeSlot(slotId: string) {
      if (this.selectedModels.length <= 1) return
      this.selectedModels = this.selectedModels.filter(s => s.slotId !== slotId)
    },
  },

  persist: [
    {
      pick: ['encryptedPayload', 'ollamaUrl', 'selectedModels'],
    },
    {
      key: 'provider-session',
      pick: ['openaiKey', 'anthropicKey', 'geminiKey', 'groqKey'],
      storage: sessionStore,
    },
  ],
})
