// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadHandler, stubNitroGlobals } from '../server/nitroTestUtils'
import { installOfflineFetchGuard } from '../offlineFetch'

/**
 * Malformed-body coverage for POST /api/stream.
 * Proves validation failures become structured 400s (not unhandled throws)
 * and never call upstream fetch.
 */
describe('API stream validation boundary', () => {
  const setHeader = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    installOfflineFetchGuard()
    setHeader.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    installOfflineFetchGuard()
  })

  const cases: Array<{ name: string, body: unknown, message: RegExp }> = [
    {
      name: 'non-object body',
      body: 'not-json-object',
      message: /Request body must be an object/i,
    },
    {
      name: 'null body',
      body: null,
      message: /Request body must be an object/i,
    },
    {
      name: 'unknown provider',
      body: { provider: 'azure', model: 'x', systemPrompt: '', userPrompt: '' },
      message: /provider/i,
    },
    {
      name: 'missing model',
      body: { provider: 'openai', model: '  ', systemPrompt: '', userPrompt: 'hi' },
      message: /model/i,
    },
    {
      name: 'non-string systemPrompt',
      body: { provider: 'openai', model: 'gpt', systemPrompt: 1, userPrompt: 'hi' },
      message: /systemPrompt/i,
    },
    {
      name: 'non-string userPrompt',
      body: { provider: 'openai', model: 'gpt', systemPrompt: '', userPrompt: null },
      message: /userPrompt/i,
    },
    {
      name: 'non-string apiKey',
      body: {
        provider: 'openai',
        model: 'gpt',
        systemPrompt: '',
        userPrompt: 'hi',
        apiKey: 123,
      },
      message: /apiKey/i,
    },
    {
      name: 'invalid ollamaUrl',
      body: {
        provider: 'ollama',
        model: 'llama',
        systemPrompt: '',
        userPrompt: 'hi',
        ollamaUrl: 'javascript:alert(1)',
      },
      message: /ollamaUrl/i,
    },
    {
      name: 'invalid lmStudioUrl',
      body: {
        provider: 'lmstudio',
        model: 'local',
        systemPrompt: '',
        userPrompt: 'hi',
        lmStudioUrl: 'ftp://evil.example',
      },
      message: /lmStudioUrl/i,
    },
    {
      name: 'non-finite temperature',
      body: {
        provider: 'openai',
        model: 'gpt',
        systemPrompt: '',
        userPrompt: 'hi',
        temperature: Number.NaN,
      },
      message: /temperature/i,
    },
    {
      name: 'non-finite maxTokens',
      body: {
        provider: 'openai',
        model: 'gpt',
        systemPrompt: '',
        userPrompt: 'hi',
        maxTokens: Number.POSITIVE_INFINITY,
      },
      message: /maxTokens/i,
    },
  ]

  it.each(cases)('returns structured 400 for $name without fetching', async ({ body, message }) => {
    stubNitroGlobals({ body, setHeader })
    const { resetRuntimeMetrics, getRuntimeMetrics } = await import('~/lib/runtimeMetrics')
    resetRuntimeMetrics()

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const handler = await loadHandler('../../server/api/stream.post')

    await expect(handler({})).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(message),
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setHeader).not.toHaveBeenCalled()
    expect(getRuntimeMetrics().streamRequests).toBe(0)
    expect(getRuntimeMetrics().streamErrors).toBe(0)
  })
})
