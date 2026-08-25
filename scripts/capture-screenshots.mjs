import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const BASE = process.env.SCREENSHOT_BASE ?? 'http://localhost:3000'
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots')

const pages = [
  { name: 'playground', path: '/', wait: 800 },
  { name: 'settings', path: '/settings', wait: 800 },
]

const demoPromptState = {
  systemPrompt: 'You are a helpful assistant.',
  userPrompt: 'Explain {{topic}} in simple terms for a {{audience}}.',
  variables: { topic: 'quantum computing', audience: 'beginner' },
  isRunning: false,
  savedPrompts: [],
  responses: [
    {
      slotId: 'slot-1',
      provider: 'groq',
      modelId: 'openai/gpt-oss-120b',
      content: 'Quantum computing uses qubits that can be 0 and 1 at the same time...',
      status: 'done',
      metrics: { latencyMs: 3060, ttftMs: 262, inputTokens: 22, outputTokens: 1418, costUsd: 0.0009 },
    },
    {
      slotId: 'slot-2',
      provider: 'gemini',
      modelId: 'gemini-3.5-flash-lite',
      content: 'Imagine a regular coin that is spinning — until you look at it...',
      status: 'done',
      metrics: { latencyMs: 3510, ttftMs: 874, inputTokens: 22, outputTokens: 747, costUsd: 0.0002 },
    },
  ],
  history: [
    {
      id: 'run-3',
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Explain {{topic}} in simple terms for a {{audience}}.',
      variables: { topic: 'quantum computing', audience: 'beginner' },
      models: [
        { slotId: 'slot-1', provider: 'groq', modelId: 'openai/gpt-oss-120b' },
        { slotId: 'slot-2', provider: 'gemini', modelId: 'gemini-3.5-flash-lite' },
      ],
      responses: [
        {
          slotId: 'slot-1', provider: 'groq', modelId: 'openai/gpt-oss-120b', content: '...', status: 'done',
          metrics: { latencyMs: 3060, ttftMs: 262, inputTokens: 22, outputTokens: 1418, costUsd: 0.0009 },
        },
        {
          slotId: 'slot-2', provider: 'gemini', modelId: 'gemini-3.5-flash-lite', content: '...', status: 'done',
          metrics: { latencyMs: 3510, ttftMs: 874, inputTokens: 22, outputTokens: 747, costUsd: 0.0002 },
        },
      ],
      createdAt: '2026-08-26T02:22:07.000Z',
    },
    {
      id: 'run-2',
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Explain {{topic}} in simple terms for a {{audience}}.',
      variables: { topic: 'quantum computing', audience: 'beginner' },
      models: [
        { slotId: 'slot-1', provider: 'groq', modelId: 'openai/gpt-oss-120b' },
        { slotId: 'slot-2', provider: 'gemini', modelId: 'gemini-3.6-flash' },
      ],
      responses: [
        {
          slotId: 'slot-1', provider: 'groq', modelId: 'openai/gpt-oss-120b', content: '...', status: 'done',
          metrics: { latencyMs: 4200, ttftMs: 310, inputTokens: 22, outputTokens: 1200, costUsd: 0.0008 },
        },
        {
          slotId: 'slot-2', provider: 'gemini', modelId: 'gemini-3.6-flash', content: '...', status: 'done',
          metrics: { latencyMs: 9800, ttftMs: 1200, inputTokens: 22, outputTokens: 890, costUsd: 0.0004 },
        },
      ],
      createdAt: '2026-08-26T02:18:12.000Z',
    },
    {
      id: 'run-1',
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Explain {{topic}} in simple terms for a {{audience}}.',
      variables: { topic: 'quantum computing', audience: 'beginner' },
      models: [
        { slotId: 'slot-1', provider: 'gemini', modelId: 'gemini-3.6-flash' },
        { slotId: 'slot-2', provider: 'gemini', modelId: 'gemini-3.5-flash-lite' },
      ],
      responses: [
        {
          slotId: 'slot-1', provider: 'gemini', modelId: 'gemini-3.6-flash', content: '...', status: 'done',
          metrics: { latencyMs: 10200, ttftMs: 1400, inputTokens: 22, outputTokens: 810, costUsd: 0.0005 },
        },
        {
          slotId: 'slot-2', provider: 'gemini', modelId: 'gemini-3.5-flash-lite', content: '...', status: 'done',
          metrics: { latencyMs: 4100, ttftMs: 920, inputTokens: 22, outputTokens: 700, costUsd: 0.0002 },
        },
      ],
      createdAt: '2026-08-26T02:14:33.000Z',
    },
  ],
}

async function seedDemoData(page) {
  await page.addInitScript((state) => {
    localStorage.setItem('prompt', JSON.stringify(state))
  }, demoPromptState)
}

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()

for (const page of pages) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const tab = await context.newPage()
  await tab.goto(`${BASE}${page.path}`, { waitUntil: 'networkidle' })
  await tab.waitForTimeout(page.wait)
  await tab.screenshot({
    path: path.join(OUT, `${page.name}.png`),
    fullPage: false,
  })
  await context.close()
}

for (const [name, route] of [['metrics', '/metrics'], ['history', '/history']]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const tab = await context.newPage()
  await seedDemoData(tab)
  await tab.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  await tab.waitForTimeout(name === 'metrics' ? 1000 : 600)
  await tab.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: name === 'metrics',
  })
  await context.close()
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(400)
await mobile.locator('button[aria-label="Open menu"]').click()
await mobile.waitForTimeout(400)
await mobile.screenshot({
  path: path.join(OUT, 'mobile-menu.png'),
  fullPage: false,
})

await browser.close()
console.log('Screenshots saved to docs/screenshots/')
