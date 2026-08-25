import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const BASE = process.env.SCREENSHOT_BASE ?? 'http://localhost:3000'
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots')

const MODELS = [
  { slotId: 'slot-1', provider: 'groq', modelId: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
  { slotId: 'slot-2', provider: 'gemini', modelId: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { slotId: 'slot-3', provider: 'openai', modelId: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { slotId: 'slot-4', provider: 'anthropic', modelId: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
]

function response(slot, content, metrics) {
  return {
    slotId: slot.slotId,
    provider: slot.provider,
    modelId: slot.modelId,
    content,
    status: 'done',
    metrics,
  }
}

const latestResponses = [
  response(MODELS[0], 'Quantum computing uses qubits that can exist in superposition — both 0 and 1 until measured. This lets certain problems be solved much faster than classical computers.', { latencyMs: 3060, ttftMs: 262, inputTokens: 22, outputTokens: 1418, costUsd: 0.0009 }),
  response(MODELS[1], 'Think of a regular bit as a coin lying flat: heads or tails. A qubit is a spinning coin — until you look, it behaves as if it could be both.', { latencyMs: 3510, ttftMs: 874, inputTokens: 22, outputTokens: 747, costUsd: 0.0004 }),
  response(MODELS[2], 'Quantum computers use the rules of quantum mechanics. Instead of regular bits, they use qubits that can represent many states at once.', { latencyMs: 2890, ttftMs: 410, inputTokens: 22, outputTokens: 920, costUsd: 0.0003 }),
  response(MODELS[3], 'At a high level, quantum computing leverages superposition and entanglement to explore many possibilities in parallel for specific types of problems.', { latencyMs: 4120, ttftMs: 680, inputTokens: 22, outputTokens: 1105, costUsd: 0.0011 }),
]

function historyEntry(id, createdAt, metricsList) {
  return {
    id,
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Explain {{topic}} in simple terms for a {{audience}}.',
    variables: { topic: 'quantum computing', audience: 'beginner' },
    models: MODELS.map(m => ({ slotId: m.slotId, provider: m.provider, modelId: m.modelId })),
    responses: MODELS.map((m, i) => response(m, 'Sample response for benchmarking.', metricsList[i])),
    createdAt,
  }
}

const demoPromptState = {
  systemPrompt: 'You are a helpful assistant.',
  userPrompt: 'Explain {{topic}} in simple terms for a {{audience}}.',
  variables: { topic: 'quantum computing', audience: 'beginner' },
  isRunning: false,
  savedPrompts: [],
  responses: latestResponses,
  history: [
    historyEntry('run-3', '2026-08-26T02:22:07.000Z', [
      { latencyMs: 3060, ttftMs: 262, inputTokens: 22, outputTokens: 1418, costUsd: 0.0009 },
      { latencyMs: 3510, ttftMs: 874, inputTokens: 22, outputTokens: 747, costUsd: 0.0004 },
      { latencyMs: 2890, ttftMs: 410, inputTokens: 22, outputTokens: 920, costUsd: 0.0003 },
      { latencyMs: 4120, ttftMs: 680, inputTokens: 22, outputTokens: 1105, costUsd: 0.0011 },
    ]),
    historyEntry('run-2', '2026-08-26T02:18:12.000Z', [
      { latencyMs: 4200, ttftMs: 310, inputTokens: 22, outputTokens: 1200, costUsd: 0.0008 },
      { latencyMs: 9800, ttftMs: 1200, inputTokens: 22, outputTokens: 890, costUsd: 0.0004 },
      { latencyMs: 3100, ttftMs: 520, inputTokens: 22, outputTokens: 880, costUsd: 0.0003 },
      { latencyMs: 5400, ttftMs: 790, inputTokens: 22, outputTokens: 1050, costUsd: 0.0012 },
    ]),
    historyEntry('run-1', '2026-08-26T02:14:33.000Z', [
      { latencyMs: 10200, ttftMs: 1400, inputTokens: 22, outputTokens: 810, costUsd: 0.0005 },
      { latencyMs: 4100, ttftMs: 920, inputTokens: 22, outputTokens: 700, costUsd: 0.0002 },
      { latencyMs: 3600, ttftMs: 480, inputTokens: 22, outputTokens: 950, costUsd: 0.0003 },
      { latencyMs: 6200, ttftMs: 910, inputTokens: 22, outputTokens: 990, costUsd: 0.0010 },
    ]),
  ],
}

const demoProviderState = {
  encryptedPayload: null,
  ollamaUrl: 'http://localhost:11434',
  selectedModels: MODELS.map(m => ({ slotId: m.slotId, provider: m.provider, modelId: m.modelId })),
  streamProxyUrl: '',
}

async function preparePage(page, { seed = false } = {}) {
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = `
      .nuxt-devtools-panel,
      .nuxt-devtools-button,
      .nuxt-devtools,
      #nuxt-devtools-container,
      [id*="nuxt-devtools"],
      iframe[src*="devtools"] { display: none !important; visibility: hidden !important; }
    `
    document.documentElement.appendChild(style)
  })

  if (seed) {
    await page.addInitScript(({ prompt, provider }) => {
      localStorage.setItem('prompt', JSON.stringify(prompt))
      localStorage.setItem('provider', JSON.stringify(provider))
    }, { prompt: demoPromptState, provider: demoProviderState })
  }
}

async function capture(contextOptions, name, route, { seed = false, fullPage = false, beforeShot } = {}) {
  const context = await browser.newContext(contextOptions)
  const tab = await context.newPage()
  await preparePage(tab, { seed })
  await tab.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  await tab.waitForTimeout(800)
  if (beforeShot) await beforeShot(tab)
  await tab.waitForTimeout(400)
  await tab.screenshot({ path: path.join(OUT, `${name}.png`), fullPage })
  await context.close()
}

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const desktop = { viewport: { width: 1280, height: 800 } }

await capture(desktop, 'playground', '/', { seed: true, fullPage: true })
await capture(desktop, 'settings', '/settings')
await capture(desktop, 'history', '/history', { seed: true })
await capture(desktop, 'metrics', '/metrics', {
  seed: true,
  fullPage: true,
  beforeShot: async (tab) => {
    await tab.getByRole('button', { name: 'Historical avg' }).click()
    await tab.waitForTimeout(600)
  },
})

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
const mobile = await mobileContext.newPage()
await preparePage(mobile)
await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(400)
await mobile.locator('button[aria-label="Open menu"]').click()
await mobile.waitForTimeout(400)
await mobile.screenshot({ path: path.join(OUT, 'mobile-menu.png') })
await mobileContext.close()

await browser.close()
console.log('Screenshots saved to docs/screenshots/')
