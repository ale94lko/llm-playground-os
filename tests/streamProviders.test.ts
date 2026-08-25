import { describe, expect, it } from 'vitest'
import { buildProviderRequest, extractTextChunk } from '../app/lib/streamProviders'

describe('streamProviders', () => {
  it('builds OpenAI request', () => {
    const req = buildProviderRequest({
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey: 'sk-test',
    })

    expect(req.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(req.headers.Authorization).toBe('Bearer sk-test')
    expect(req.format).toBe('sse')
  })

  it('builds Anthropic request with browser access header', () => {
    const req = buildProviderRequest({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey: 'sk-ant-test',
    })

    expect(req.url).toContain('anthropic.com')
    expect(req.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
  })

  it('builds Groq request', () => {
    const req = buildProviderRequest({
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey: 'gsk-test',
    })

    expect(req.url).toContain('groq.com')
    expect(req.format).toBe('sse')
  })

  it('builds Gemini request with API key in URL', () => {
    const req = buildProviderRequest({
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey: 'AIza-test',
    })

    expect(req.url).toContain('generativelanguage.googleapis.com')
    expect(req.url).toContain('key=AIza-test')
  })

  it('builds Ollama NDJSON request', () => {
    const req = buildProviderRequest({
      provider: 'ollama',
      model: 'llama3.2',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      ollamaUrl: 'http://localhost:11434',
    })

    expect(req.url).toBe('http://localhost:11434/api/chat')
    expect(req.format).toBe('ollama')
  })

  it('extracts chunks per provider', () => {
    expect(extractTextChunk({
      choices: [{ delta: { content: 'hello' } }],
    }, 'openai')).toBe('hello')

    expect(extractTextChunk({
      type: 'content_block_delta',
      delta: { text: 'hi' },
    }, 'anthropic')).toBe('hi')

    expect(extractTextChunk({
      message: { content: 'local' },
    }, 'ollama')).toBe('local')
  })
})
