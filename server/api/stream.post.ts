import type { ProviderId, StreamRequest } from '~/types/llm'

export default defineEventHandler(async (event) => {
  const body = await readBody<StreamRequest>(event)

  if (!body?.provider || !body?.model) {
    throw createError({ statusCode: 400, message: 'Missing provider or model' })
  }

  const { provider, model, systemPrompt, userPrompt, apiKey, ollamaUrl } = body

  let url: string
  let headers: Record<string, string> = { 'Content-Type': 'application/json' }
  let payload: Record<string, unknown>

  switch (provider as ProviderId) {
    case 'openai':
      url = 'https://api.openai.com/v1/chat/completions'
      headers.Authorization = `Bearer ${apiKey}`
      payload = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
      }
      break

    case 'groq':
      url = 'https://api.groq.com/openai/v1/chat/completions'
      headers.Authorization = `Bearer ${apiKey}`
      payload = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
      }
      break

    case 'anthropic':
      url = 'https://api.anthropic.com/v1/messages'
      headers['x-api-key'] = apiKey ?? ''
      headers['anthropic-version'] = '2023-06-01'
      payload = {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        stream: true,
      }
      break

    case 'gemini':
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
      payload = {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }
      break

    case 'ollama':
      url = `${ollamaUrl ?? 'http://localhost:11434'}/api/chat`
      payload = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
      }
      break

    default:
      throw createError({ statusCode: 400, message: `Unknown provider: ${provider}` })
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!upstream.ok) {
      const errorText = await upstream.text()
      let message = upstream.statusText
      try {
        const parsed = JSON.parse(errorText)
        message = parsed.error?.message ?? parsed.message ?? errorText
      }
      catch {
        message = errorText || message
      }
      throw createError({ statusCode: upstream.status, message })
    }

    setResponseHeader(event, 'Content-Type', 'text/event-stream')
    setResponseHeader(event, 'Cache-Control', 'no-cache')
    setResponseHeader(event, 'Connection', 'keep-alive')

    if (provider === 'ollama') {
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
