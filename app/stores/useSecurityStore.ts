import { defineStore } from 'pinia'
import {
  deriveKey,
  encryptJson,
  generateSalt,
  hashPassword,
  parseSalt,
  verifyPassword,
  type ApiKeysPayload,
} from '~/lib/crypto'

export const useSecurityStore = defineStore('security', {
  state: () => ({
    salt: '',
    passwordVerifier: '',
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

      await useProviderStore().encryptAndPersistKeys()
    },

    async unlock(password: string): Promise<boolean> {
      const valid = await verifyPassword(password, this.salt, this.passwordVerifier)
      if (!valid) return false

      this._cryptoKey = await deriveKey(password, parseSalt(this.salt))
      this.isUnlocked = true
      await useProviderStore().decryptKeys(this._cryptoKey)
      return true
    },

    lock() {
      useProviderStore().clearDecryptedKeys()
      this._cryptoKey = null
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

      await useProviderStore().encryptAndPersistKeys()
      return true
    },
  },

  persist: {
    pick: ['salt', 'passwordVerifier'],
  },
})

export type { ApiKeysPayload }
