import type { ProviderId } from '~/types/llm'

export type ExportLanguage = 'javascript' | 'python' | 'curl' | 'php'

interface ExportOptions {
  provider: ProviderId
  model: string
  systemPrompt: string
  userPrompt: string
  apiKey?: string
  ollamaUrl?: string
}

export function useCodeExporter() {
  function exportCode(language: ExportLanguage, opts: ExportOptions): string {
    switch (language) {
      case 'javascript': return exportJavaScript(opts)
      case 'python': return exportPython(opts)
      case 'curl': return exportCurl(opts)
      case 'php': return exportPhp(opts)
    }
  }

  return { exportCode }
}

function exportJavaScript(opts: ExportOptions): string {
  if (opts.provider === 'ollama') {
    return `const response = await fetch('${opts.ollamaUrl ?? 'http://localhost:11434'}/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: '${opts.model}',
    messages: [
      { role: 'system', content: ${JSON.stringify(opts.systemPrompt)} },
      { role: 'user', content: ${JSON.stringify(opts.userPrompt)} },
    ],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let result = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split('\\n').filter(Boolean);
  for (const line of lines) {
    const chunk = JSON.parse(line);
    result += chunk.message?.content ?? '';
    process.stdout.write(chunk.message?.content ?? '');
  }
}`
  }

  const baseUrl = getBaseUrl(opts.provider)
  const headers = getHeaders(opts)

  return `const response = await fetch('${baseUrl}', {
  method: 'POST',
  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ')},
  body: JSON.stringify({
    model: '${opts.model}',
    messages: [
      { role: 'system', content: ${JSON.stringify(opts.systemPrompt)} },
      { role: 'user', content: ${JSON.stringify(opts.userPrompt)} },
    ],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE chunks (data: {...})
  console.log(chunk);
}`
}

function exportPython(opts: ExportOptions): string {
  if (opts.provider === 'openai') {
    return `from openai import OpenAI

client = OpenAI(api_key="${opts.apiKey ?? 'YOUR_API_KEY'}")

stream = client.chat.completions.create(
    model="${opts.model}",
    messages=[
        {"role": "system", "content": ${JSON.stringify(opts.systemPrompt)}},
        {"role": "user", "content": ${JSON.stringify(opts.userPrompt)}},
    ],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)`
  }

  if (opts.provider === 'anthropic') {
    return `import anthropic

client = anthropic.Anthropic(api_key="${opts.apiKey ?? 'YOUR_API_KEY'}")

with client.messages.stream(
    model="${opts.model}",
    max_tokens=1024,
    system=${JSON.stringify(opts.systemPrompt)},
    messages=[{"role": "user", "content": ${JSON.stringify(opts.userPrompt)}}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)`
  }

  return `# Provider: ${opts.provider}
# Use the corresponding SDK or REST API
# Model: ${opts.model}
# System: ${JSON.stringify(opts.systemPrompt)}
# User: ${JSON.stringify(opts.userPrompt)}`
}

function exportCurl(opts: ExportOptions): string {
  if (opts.provider === 'ollama') {
    return `curl ${opts.ollamaUrl ?? 'http://localhost:11434'}/api/chat \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    stream: true,
  })}'`
  }

  const baseUrl = getBaseUrl(opts.provider)
  const headers = getHeaders(opts)
  const headerFlags = Object.entries(headers)
    .map(([k, v]) => `-H "${k}: ${v}"`)
    .join(' \\\n  ')

  return `curl ${baseUrl} \\
  ${headerFlags} \\
  -d '${JSON.stringify({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    stream: true,
  })}'`
}

function exportPhp(opts: ExportOptions): string {
  const url = opts.provider === 'ollama'
    ? `${opts.ollamaUrl ?? 'http://localhost:11434'}/api/chat`
    : getBaseUrl(opts.provider)

  const body = JSON.stringify({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    stream: true,
  }, null, 2)

  return `<?php

$ch = curl_init('${url}');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ${phpHeadersArray(opts)},
    CURLOPT_POSTFIELDS => '${body.replace(/'/g, "\\'")}',
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_WRITEFUNCTION => function ($ch, $data) {
        echo $data;
        return strlen($data);
    },
]);

curl_exec($ch);
curl_close($ch);`
}

function getBaseUrl(provider: ProviderId): string {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1/chat/completions'
    case 'anthropic': return 'https://api.anthropic.com/v1/messages'
    case 'gemini': return 'https://generativelanguage.googleapis.com/v1beta/models/MODEL:streamGenerateContent'
    case 'groq': return 'https://api.groq.com/openai/v1/chat/completions'
    default: return ''
  }
}

function getHeaders(opts: ExportOptions): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  switch (opts.provider) {
    case 'openai':
      headers.Authorization = `Bearer ${opts.apiKey ?? 'YOUR_API_KEY'}`
      break
    case 'anthropic':
      headers['x-api-key'] = opts.apiKey ?? 'YOUR_API_KEY'
      headers['anthropic-version'] = '2023-06-01'
      break
    case 'gemini':
      headers['x-goog-api-key'] = opts.apiKey ?? 'YOUR_API_KEY'
      break
    case 'groq':
      headers.Authorization = `Bearer ${opts.apiKey ?? 'YOUR_API_KEY'}`
      break
  }

  return headers
}

function phpHeadersArray(opts: ExportOptions): string {
  const headers = getHeaders(opts)
  const lines = Object.entries(headers).map(([k, v]) => `    '${k}: ${v}'`)
  return "[\n" + lines.join(",\n") + ",\n]"
}
