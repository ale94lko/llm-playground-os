export interface EncryptedPayload {
  v: 1
  iv: string
  data: string
}

export interface ApiKeysPayload {
  openaiKey: string
  anthropicKey: string
  geminiKey: string
  groqKey: string
}

const PBKDF2_ITERATIONS = 100_000
const SALT_BYTES = 16
const IV_BYTES = 12

function toBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

export function generateSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)))
}

export function parseSalt(salt: string): Uint8Array {
  return fromBase64(salt)
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${password}:${salt}`))
  return toBase64(new Uint8Array(digest))
}

export async function encryptJson(key: CryptoKey, payload: unknown): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const encoded = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return {
    v: 1,
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptJson<T>(key: CryptoKey, payload: EncryptedPayload): Promise<T> {
  const iv = fromBase64(payload.iv)
  const data = fromBase64(payload.data)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return JSON.parse(new TextDecoder().decode(decrypted)) as T
}

export async function verifyPassword(password: string, salt: string, verifier: string): Promise<boolean> {
  const hash = await hashPassword(password, salt)
  return hash === verifier
}
