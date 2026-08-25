import type { StreamRequest } from '~/types/llm'
import { buildProviderRequest, parseProviderError } from '~/lib/streamProviders'

export default defineEventHandler(async (event) => {
  const body = await readBody<StreamRequest>(event)

  if (!body?.provider || !body?.model) {
    throw createError({ statusCode: 400, message: 'Missing provider or model' })
  }

  const providerRequest = buildProviderRequest(body)

  try {
    const upstream = await fetch(providerRequest.url, {
      method: 'POST',
      headers: providerRequest.headers,
      body: providerRequest.body,
    })

    if (!upstream.ok) {
      throw createError({
        statusCode: upstream.status,
        message: await parseProviderError(upstream),
      })
    }

    setResponseHeader(event, 'Content-Type', 'text/event-stream')
    setResponseHeader(event, 'Cache-Control', 'no-cache')
    setResponseHeader(event, 'Connection', 'keep-alive')

    if (providerRequest.format === 'ollama') {
      return transformOllamaStream(upstream)
    }

    return upstream.body
  }
  catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    const message = err instanceof Error ? err.message : 'Upstream request failed'
    throw createError({ statusCode: 502, message })
  }
})

async function* transformOllamaStream(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        const text = parsed.message?.content ?? ''
        if (text) {
          yield `data: ${JSON.stringify({ message: { content: text } })}\n\n`
        }
        if (parsed.done) {
          yield 'data: [DONE]\n\n'
        }
      }
      catch {
        // skip
      }
    }
  }
}
