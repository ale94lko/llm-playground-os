import { describe, expect, it } from 'vitest'
import { DEPRECATED_MODEL_MAP, PROVIDER_MODELS } from '../app/lib/providerModels'

describe('provider models', () => {
  it('uses current Gemini model IDs', () => {
    const geminiIds = PROVIDER_MODELS.filter(m => m.provider === 'gemini').map(m => m.id)
    expect(geminiIds).toContain('gemini-3.6-flash')
    expect(geminiIds).not.toContain('gemini-2.0-flash')
  })

  it('maps retired Gemini models to replacements', () => {
    expect(DEPRECATED_MODEL_MAP['gemini-2.0-flash']).toBe('gemini-3.6-flash')
    expect(DEPRECATED_MODEL_MAP['gemini-2.5-pro-preview-05-06']).toBe('gemini-2.5-pro')
  })
})
