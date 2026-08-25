import type { ProviderId, StreamRequest } from '~/types/llm'

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: string) => void
  onFirstToken?: (ttftMs: number) => void
}

export function useLLMStream() {
  async function streamCompletion(
    request: StreamRequest,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const startTime = performance.now()
    let firstTokenReceived = false

    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }))
        callbacks.onError(err.message ?? `HTTP ${response.status}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        callbacks.onError('No response stream available')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const text = extractTextChunk(parsed, request.provider)
            if (text) {
              if (!firstTokenReceived) {
                firstTokenReceived = true
                callbacks.onFirstToken?.(performance.now() - startTime)
              }
              callbacks.onChunk(text)
            }
          }
          catch {
            // skip malformed SSE chunks
          }
        }
      }

      callbacks.onDone()
    }
    catch (err) {
      if (signal?.aborted) return
      callbacks.onError(err instanceof Error ? err.message : 'Stream failed')
    }
  }

  return { streamCompletion }
}

function extractTextChunk(parsed: Record<string, unknown>, provider: ProviderId): string {
  switch (provider) {
    case 'anthropic':
      if (parsed.type === 'content_block_delta') {
        const delta = parsed.delta as { text?: string }
        return delta?.text ?? ''
      }
      return ''

    case 'gemini': {
      const candidates = parsed.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
      return candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    }

    case 'ollama': {
      const message = parsed.message as { content?: string } | undefined
      return message?.content ?? parsed.response as string ?? ''
    }

    default: {
      const choices = parsed.choices as Array<{ delta?: { content?: string } }> | undefined
      return choices?.[0]?.delta?.content ?? ''
    }
  }
}
