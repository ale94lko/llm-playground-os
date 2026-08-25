import { describe, expect, it } from 'vitest'
import { detectVariables, interpolateVariables, syncVariableKeys } from '../app/lib/variables'

describe('variables', () => {
  it('detects unique variable names from prompts', () => {
    const vars = detectVariables(
      'You help {{audience}}.',
      'Explain {{topic}} to {{audience}}.',
    )
    expect(vars).toEqual(['audience', 'topic'])
  })

  it('interpolates variables into text', () => {
    const result = interpolateVariables(
      'Hello {{name}}, welcome to {{place}}.',
      { name: 'Ada', place: 'Nuxt' },
    )
    expect(result).toBe('Hello Ada, welcome to Nuxt.')
  })

  it('keeps placeholder for missing variables', () => {
    const result = interpolateVariables('Hi {{name}}', {})
    expect(result).toBe('Hi {{name}}')
  })

  it('syncs new variable keys with empty defaults', () => {
    const synced = syncVariableKeys(['topic', 'audience'], { topic: 'AI' })
    expect(synced).toEqual({ topic: 'AI', audience: '' })
  })
})
