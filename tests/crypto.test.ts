import { describe, expect, it } from 'vitest'
import {
  decryptJson,
  deriveKey,
  encryptJson,
  generateSalt,
  hashPassword,
  parseSalt,
  verifyPassword,
  type ApiKeysPayload,
} from '../app/lib/crypto'

describe('crypto', () => {
  const sampleKeys: ApiKeysPayload = {
    openaiKey: 'sk-test-openai',
    anthropicKey: 'sk-ant-test',
    geminiKey: 'AIza-test',
    groqKey: 'gsk_test',
  }

  it('encrypts and decrypts API keys payload', async () => {
    const salt = parseSalt(generateSalt())
    const key = await deriveKey('my-secure-password', salt)
    const encrypted = await encryptJson(key, sampleKeys)
    const decrypted = await decryptJson<ApiKeysPayload>(key, encrypted)
    expect(decrypted).toEqual(sampleKeys)
  })

  it('verifies master password hash', async () => {
    const salt = generateSalt()
    const verifier = await hashPassword('correct-horse', salt)
    expect(await verifyPassword('correct-horse', salt, verifier)).toBe(true)
    expect(await verifyPassword('wrong-password', salt, verifier)).toBe(false)
  })

  it('produces different ciphertext for same payload', async () => {
    const salt = parseSalt(generateSalt())
    const key = await deriveKey('password123', salt)
    const a = await encryptJson(key, sampleKeys)
    const b = await encryptJson(key, sampleKeys)
    expect(a.data).not.toBe(b.data)
  })
})
