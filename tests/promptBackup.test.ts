// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import {
  PROMPT_BACKUP_VERSION,
  applyPromptBackupImport,
  createPromptBackup,
  exportPromptBackupJson,
  mergePromptBackup,
  parsePromptBackup,
  serializePromptBackup,
  upsertSavedPrompt,
} from '../app/lib/promptBackup'
import type { ExecutionHistoryEntry, SavedPrompt } from '../app/types/llm'

const historyEntry = (id: string, prompt = 'Hello'): ExecutionHistoryEntry => ({
  id,
  systemPrompt: 'Sys',
  userPrompt: prompt,
  variables: { topic: 'x', api_key: 'sk-should-not-export', openaiKey: 'nope' },
  models: [{ slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' }],
  responses: [{
    slotId: 'slot-1',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    content: 'Hi',
    status: 'done',
    metrics: { latencyMs: 10, ttftMs: 2, inputTokens: 1, outputTokens: 1, costUsd: 0 },
  }],
  createdAt: '2026-09-16T10:00:00.000Z',
})

const savedPrompt = (id: string, name: string): SavedPrompt => ({
  id,
  name,
  systemPrompt: 'Sys',
  userPrompt: 'User {{topic}}',
  tags: ['demo'],
  version: 1,
  createdAt: '2026-09-16T09:00:00.000Z',
  updatedAt: '2026-09-16T09:30:00.000Z',
  variables: { topic: 'quantum', password: 'secret-value' },
  model: 'gpt-4o-mini',
  provider: 'openai',
  generation: { temperature: 0.4, maxTokens: 256 },
  revisions: [],
})

describe('promptBackup', () => {
  it('serializes a versioned backup and strips secret variables', () => {
    const payload = createPromptBackup(
      [historyEntry('h1')],
      [savedPrompt('s1', 'Demo')],
      '2026-09-16T12:00:00.000Z',
    )
    const json = serializePromptBackup(payload)

    expect(payload.version).toBe(PROMPT_BACKUP_VERSION)
    expect(json).toContain('"version": 1')
    expect(json).not.toContain('sk-should-not-export')
    expect(json).not.toContain('openaiKey')
    expect(json).not.toContain('secret-value')
    expect(json).not.toContain('encryptedPayload')
    expect(json).not.toContain('passwordVerifier')
    expect(payload.history[0]?.variables).toEqual({ topic: 'x' })
    expect(payload.savedPrompts[0]?.variables).toEqual({ topic: 'quantum' })
  })

  it('round-trips parse after serialize', () => {
    const original = createPromptBackup([historyEntry('h1')], [savedPrompt('s1', 'Demo')])
    const parsed = parsePromptBackup(serializePromptBackup(original))
    expect(parsed.history).toHaveLength(1)
    expect(parsed.savedPrompts).toHaveLength(1)
    expect(parsed.history[0]?.id).toBe('h1')
    expect(parsed.savedPrompts[0]?.name).toBe('Demo')
    expect(parsed.savedPrompts[0]?.generation).toEqual({ temperature: 0.4, maxTokens: 256 })
  })

  it('rejects invalid JSON and unsupported versions', () => {
    expect(() => parsePromptBackup('{')).toThrow(/invalid json/i)
    expect(() => parsePromptBackup(JSON.stringify({ version: 99, history: [], savedPrompts: [] }))).toThrow(/unsupported/i)
  })

  it('schema-validates backup envelopes with valibot safeParse', async () => {
    const { promptBackupSchema } = await import('../app/lib/schemas/promptBackup')
    const { safeParse } = await import('valibot')

    const ok = safeParse(promptBackupSchema, {
      version: 1,
      history: [],
      savedPrompts: [],
    })
    expect(ok.success).toBe(true)

    const bad = safeParse(promptBackupSchema, { version: 2 })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      expect(JSON.stringify(bad.issues)).not.toMatch(/apiKey|sk-/i)
    }
  })

  it('merges by id without dropping local-only items', () => {
    const current = {
      history: [historyEntry('local-h')],
      savedPrompts: [savedPrompt('local-s', 'Local')],
    }
    const incoming = createPromptBackup(
      [historyEntry('import-h', 'Imported')],
      [savedPrompt('local-s', 'Updated')],
    )
    const merged = mergePromptBackup(current, incoming)
    expect(merged.history.map(h => h.id).sort()).toEqual(['import-h', 'local-h'])
    expect(merged.savedPrompts).toHaveLength(1)
    expect(merged.savedPrompts[0]?.name).toBe('Updated')
  })

  it('exports and applies replace/merge via store-facing helpers', () => {
    const json = exportPromptBackupJson([historyEntry('h1')], [savedPrompt('s1', 'Demo')])
    expect(json).toContain('"version": 1')

    const replaced = applyPromptBackupImport(
      { history: [historyEntry('old')], savedPrompts: [savedPrompt('old-s', 'Old')] },
      json,
      'replace',
    )
    expect(replaced.history.map(h => h.id)).toEqual(['h1'])
    expect(replaced.savedPrompts.map(p => p.name)).toEqual(['Demo'])
    expect(replaced.imported).toEqual({ history: 1, savedPrompts: 1 })

    const merged = applyPromptBackupImport(
      { history: [historyEntry('keep')], savedPrompts: [savedPrompt('keep-s', 'Keep')] },
      json,
      'merge',
    )
    expect(merged.history.map(h => h.id).sort()).toEqual(['h1', 'keep'])
    expect(merged.savedPrompts.map(p => p.name).sort()).toEqual(['Demo', 'Keep'])
  })

  it('upserts saved prompts with revisions on rename collision', () => {
    const draft = {
      systemPrompt: 'sys',
      userPrompt: 'user',
      variables: { topic: 'a' },
      generation: { temperature: 0.5 },
    }
    const created = upsertSavedPrompt([], draft, 'Demo', ['tag'], { model: 'gpt-4o-mini', provider: 'openai' }, {
      now: '2026-09-19T00:00:00.000Z',
      createId: () => 'id-1',
    })
    expect(created.prompt.version).toBe(1)
    expect(created.savedPrompts).toHaveLength(1)

    const bumped = upsertSavedPrompt(
      created.savedPrompts,
      { ...draft, systemPrompt: 'sys-v2', userPrompt: 'user-v2' },
      'Demo',
      [],
      {},
      { now: '2026-09-19T01:00:00.000Z', createId: () => 'unused' },
    )
    expect(bumped.prompt.version).toBe(2)
    expect(bumped.prompt.systemPrompt).toBe('sys-v2')
    expect(bumped.prompt.revisions).toHaveLength(1)
    expect(bumped.prompt.revisions[0]?.systemPrompt).toBe('sys')
    expect(bumped.savedPrompts).toHaveLength(1)
  })
})
