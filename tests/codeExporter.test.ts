import { describe, expect, it } from 'vitest'
import { useCodeExporter } from '../app/composables/useCodeExporter'

describe('useCodeExporter', () => {
  const { exportCode } = useCodeExporter()

  const baseOpts = {
    provider: 'openai' as const,
    model: 'gpt-4o-mini',
    systemPrompt: 'You are helpful.',
    userPrompt: 'Say hi',
    apiKey: 'sk-test',
  }

  it('exports JavaScript fetch snippet', () => {
    const code = exportCode('javascript', baseOpts)
    expect(code).toContain('fetch(')
    expect(code).toContain('gpt-4o-mini')
    expect(code).toContain('Bearer sk-test')
  })

  it('exports Python OpenAI snippet', () => {
    const code = exportCode('python', baseOpts)
    expect(code).toContain('from openai import OpenAI')
    expect(code).toContain('gpt-4o-mini')
  })

  it('exports cURL command', () => {
    const code = exportCode('curl', baseOpts)
    expect(code).toContain('curl https://api.openai.com')
    expect(code).toContain('Authorization')
  })

  it('exports PHP curl snippet', () => {
    const code = exportCode('php', baseOpts)
    expect(code).toContain('curl_init')
    expect(code).toContain('gpt-4o-mini')
  })

  it('exports Ollama JavaScript without API key', () => {
    const code = exportCode('javascript', {
      provider: 'ollama',
      model: 'llama3.2',
      systemPrompt: 'Sys',
      userPrompt: 'User',
      ollamaUrl: 'http://localhost:11434',
    })
    expect(code).toContain('localhost:11434')
    expect(code).not.toContain('Bearer')
  })
})
