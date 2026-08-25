import type { StreamRequest } from '~/types/llm'
import {
  buildProviderRequest,
  corsHint,
  extractTextChunk,
  parseProviderError,
  type StreamFormat,
} from '~/lib/streamProviders'

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: string) => void
  onFirstToken?: (ttftMs: number) => void
}

export function resolveStreamEndpoint(streamProxyUrl: string): string | null {
  const proxy = streamProxyUrl.trim()
  if (proxy) return proxy.replace(/\/$/, '')
  if (import.meta.dev) return '/api/stream'
  return null
}

export async function streamCompletionDirect(
  request: StreamRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const startTime = performance.now()
  let firstTokenReceived = false

  try {
    const providerRequest = buildProviderRequest(request)
    const response = await fetch(providerRequest.url, {
      method: 'POST',
      headers: providerRequest.headers,
      body: providerRequest.body,
      signal,
    })

    if (!response.ok) {
      callbacks.onError(await parseProviderError(response))
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError('No response stream available')
      return
    }

    await readStream(reader, providerRequest.format, request, {
      onChunk(text) {
        if (!firstTokenReceived) {
          firstTokenReceived = true
          callbacks.onFirstToken?.(performance.now() - startTime)
        }
        callbacks.onChunk(text)
      },
      onDone: callbacks.onDone,
    })
  }
  catch (err) {
    if (signal?.aborted) return

    if (err instanceof TypeError) {
      callbacks.onError(`Network error: ${corsHint(request.provider)}`)
      return
    }

    callbacks.onError(err instanceof Error ? err.message : 'Stream failed')
  }
}

export async function streamCompletionViaProxy(
  endpoint: string,
  request: StreamRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const startTime = performance.now()
  let firstTokenReceived = false

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }))
      callbacks.onError((err as { message?: string }).message ?? `HTTP ${response.status}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError('No response stream available')
      return
    }

    await readStream(reader, 'sse', request, {
      onChunk(text) {
        if (!firstTokenReceived) {
          firstTokenReceived = true
          callbacks.onFirstToken?.(performance.now() - startTime)
        }
        callbacks.onChunk(text)
      },
      onDone: callbacks.onDone,
    })
  }
  catch (err) {
    if (signal?.aborted) return
    callbacks.onError(err instanceof Error ? err.message : 'Stream failed')
  }
}

async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  format: StreamFormat,
  request: StreamRequest,
  handlers: { onChunk: (text: string) => void, onDone: () => void },
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    if (format === 'ollama') {
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>
          const text = extractTextChunk(parsed, request.provider)
          if (text) handlers.onChunk(text)
        }
        catch {
          // skip malformed chunks
        }
      }
      continue
    }

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data) as Record<string, unknown>
        const text = extractTextChunk(parsed, request.provider)
        if (text) handlers.onChunk(text)
      }
      catch {
        // skip malformed SSE chunks
      }
    }
  }

  handlers.onDone()
}
