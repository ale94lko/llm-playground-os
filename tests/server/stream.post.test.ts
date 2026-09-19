// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collectAsyncIterable,
  loadHandler,
  stubNitroGlobals,
  textStream,
} from './nitroTestUtils'
import { installOfflineFetchGuard } from '../offlineFetch'

const openaiBody = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  systemPrompt: 'Sys',
  userPrompt: 'Hi',
  apiKey: 'sk-test',
}

const ollamaBody = {
  provider: 'ollama',
  model: 'llama3.2',
  systemPrompt: 'Sys',
  userPrompt: 'Hi',
  ollamaUrl: 'http://localhost:11434',
}

describe('server/api/stream.post', () => {
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

  async function metrics() {
    return import('~/lib/runtimeMetrics')
  }

  it('rejects invalid bodies with 400 and does not fetch upstream', async () => {
    stubNitroGlobals({
      body: { provider: 'unknown', model: 'x', systemPrompt: '', userPrompt: '' },
      setHeader,
    })
    const { resetRuntimeMetrics, getRuntimeMetrics } = await metrics()
    resetRuntimeMetrics()

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const handler = await loadHandler('../../server/api/stream.post')

    await expect(handler({})).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/provider/i),
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getRuntimeMetrics().streamRequests).toBe(0)
  })

  it('proxies a successful SSE upstream body and records a stream request', async () => {
    stubNitroGlobals({ body: openaiBody, setHeader })
    const { resetRuntimeMetrics } = await metrics()
    resetRuntimeMetrics()

    const upstreamBody = textStream([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(upstreamBody, { status: 200 })))

    const handler = await loadHandler('../../server/api/stream.post')
    const result = await handler({})

    const { getRuntimeMetrics: getMetricsAfter } = await metrics()

    expect(result).toBeInstanceOf(ReadableStream)
    expect(setHeader).toHaveBeenCalledWith(expect.anything(), 'Content-Type', 'text/event-stream')
    expect(setHeader).toHaveBeenCalledWith(expect.anything(), 'Cache-Control', 'no-cache')
    expect(setHeader).toHaveBeenCalledWith(expect.anything(), 'Connection', 'keep-alive')
    expect(getMetricsAfter().streamRequests).toBe(1)
    expect(getMetricsAfter().streamErrors).toBe(0)
  })

  it('transforms Ollama NDJSON into SSE chunks', async () => {
    stubNitroGlobals({ body: ollamaBody, setHeader })
    const { resetRuntimeMetrics } = await metrics()
    resetRuntimeMetrics()

    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      textStream([
        '{"message":{"content":"Hi"}}\n',
        '{"message":{"content":"!"},"done":true}\n',
      ]),
      { status: 200 },
    )))

    const handler = await loadHandler('../../server/api/stream.post')
    const result = await handler({})
    const chunks = await collectAsyncIterable(result as AsyncIterable<string>)
    const { getRuntimeMetrics } = await metrics()

    expect(chunks.join('')).toContain('data: {"message":{"content":"Hi"}}')
    expect(chunks.join('')).toContain('data: {"message":{"content":"!"}}')
    expect(chunks.join('')).toContain('data: [DONE]')
    expect(getRuntimeMetrics().streamRequests).toBe(1)
  })

  it('forwards upstream HTTP errors with the provider status and message', async () => {
    stubNitroGlobals({ body: openaiBody, setHeader })
    const { resetRuntimeMetrics } = await metrics()
    resetRuntimeMetrics()

    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'quota exceeded' } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )))

    const handler = await loadHandler('../../server/api/stream.post')

    await expect(handler({})).rejects.toMatchObject({
      statusCode: 429,
      message: 'quota exceeded',
    })
    const { getRuntimeMetrics } = await metrics()
    expect(getRuntimeMetrics().streamRequests).toBe(1)
    expect(getRuntimeMetrics().streamErrors).toBe(1)
  })

  it('maps network failures to 502', async () => {
    stubNitroGlobals({ body: openaiBody, setHeader })
    const { resetRuntimeMetrics } = await metrics()
    resetRuntimeMetrics()

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed')
    }))

    const handler = await loadHandler('../../server/api/stream.post')

    await expect(handler({})).rejects.toMatchObject({
      statusCode: 502,
      message: 'fetch failed',
    })
    const { getRuntimeMetrics } = await metrics()
    expect(getRuntimeMetrics().streamErrors).toBe(1)
  })
})
