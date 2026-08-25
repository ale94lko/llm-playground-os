import { defineStore } from 'pinia'
import {
  deriveKey,
  generateSalt,
  hashPassword,
  parseSalt,
  verifyPassword,
  saveSessionCryptoKey,
  loadSessionCryptoKey,
  loadPersistedCryptoKey,
  type ApiKeysPayload,
} from '~/lib/crypto'

export const useSecurityStore = defineStore('security', {
  state: () => ({
    salt: '',
    passwordVerifier: '',
    /** Controls whether API key values are visible/editable in Settings UI */
    isUnlocked: false,
    _cryptoKey: null as CryptoKey | null,
  }),

  getters: {
    hasMasterPassword(state): boolean {
      return !!state.passwordVerifier
    },

    isLocked(state): boolean {
      return !!state.passwordVerifier && !state.isUnlocked
    },

    /** Hide key values in Settings when vault exists and UI is locked */
    hideKeyValues(state): boolean {
      return !!state.passwordVerifier && !state.isUnlocked
    },
  },

  actions: {
    async setupMasterPassword(password: string) {
      if (password.length < 8) {
        throw new Error('Master password must be at least 8 characters')
      }

      const salt = generateSalt()
      const verifier = await hashPassword(password, salt)
      const key = await deriveKey(password, parseSalt(salt))

      this.salt = salt
      this.passwordVerifier = verifier
      this._cryptoKey = key
      this.isUnlocked = true

      await saveSessionCryptoKey(key)
      await useProviderStore().encryptAndPersistKeys()
    },

    async unlock(password: string): Promise<boolean> {
      const valid = await verifyPassword(password, this.salt, this.passwordVerifier)
      if (!valid) return false

      const key = await deriveKey(password, parseSalt(this.salt))
      this._cryptoKey = key
      this.isUnlocked = true
      await saveSessionCryptoKey(key)

      const provider = useProviderStore()
      if (provider.encryptedPayload) {
        await provider.decryptKeys(key)
      }
      return true
    },

    /** Hide keys in UI only — keys stay in memory and keep working */
    lock() {
      this.isUnlocked = false
    },

    getCryptoKey(): CryptoKey | null {
      return this._cryptoKey
    },

    async changeMasterPassword(currentPassword: string, newPassword: string): Promise<boolean> {
      const valid = await verifyPassword(currentPassword, this.salt, this.passwordVerifier)
      if (!valid) return false
      if (newPassword.length < 8) {
        throw new Error('Master password must be at least 8 characters')
      }

      const salt = generateSalt()
      const verifier = await hashPassword(newPassword, salt)
      const key = await deriveKey(newPassword, parseSalt(salt))

      this.salt = salt
      this.passwordVerifier = verifier
      this._cryptoKey = key
      this.isUnlocked = true

      await saveSessionCryptoKey(key)
      await useProviderStore().encryptAndPersistKeys()
      return true
    },

    /** Load keys into memory silently — playground works even when UI is locked */
    async bootstrapKeys(): Promise<void> {
      const provider = useProviderStore()
      const hasAnyKey = !!(
        provider.openaiKey
        || provider.anthropicKey
        || provider.geminiKey
        || provider.groqKey
      )

      if (!this.hasMasterPassword) return

      const cryptoKey = await loadSessionCryptoKey() ?? await loadPersistedCryptoKey()
      if (!cryptoKey) return

      this._cryptoKey = cryptoKey

      if (!hasAnyKey && provider.encryptedPayload) {
        await provider.decryptKeys(cryptoKey)
      }
    },
  },

  persist: {
    pick: ['salt', 'passwordVerifier'],
  },
})

export type { ApiKeysPayload }
