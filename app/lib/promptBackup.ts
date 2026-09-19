// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import * as v from 'valibot'
import { isSecretFrontmatterKey } from '~/lib/promptSecrets'
import {
  PROMPT_BACKUP_VERSION,
  firstSchemaIssue,
  promptBackupSchema,
} from '~/lib/schemas/promptBackup'
import type {
  AssertionResult,
  AssertionSummary,
  ExecutionHistoryEntry,
  GenerationParams,
  ModelResponse,
  PromptRevision,
  PromptVariables,
  ProviderId,
  SavedPrompt,
  SelectedModel,
  StreamMetrics,
  StreamStatus,
} from '~/types/llm'

export { PROMPT_BACKUP_VERSION }

export type PromptBackupMode = 'merge' | 'replace'

export interface PromptBackupPayload {
  version: typeof PROMPT_BACKUP_VERSION
  exportedAt: string
  history: ExecutionHistoryEntry[]
  savedPrompts: SavedPrompt[]
}

export class PromptBackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PromptBackupError'
  }
}

const PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'gemini', 'groq', 'ollama', 'lmstudio']
const STATUSES: StreamStatus[] = ['idle', 'streaming', 'done', 'error', 'cancelled']

function scrubVariables(variables: PromptVariables | undefined): PromptVariables {
  const next: PromptVariables = {}
  for (const [key, value] of Object.entries(variables ?? {})) {
    if (isSecretFrontmatterKey(key)) continue
    if (typeof value !== 'string') continue
    next[key] = value
  }
  return next
}

function scrubGeneration(generation: GenerationParams | undefined): GenerationParams | undefined {
  if (!generation || typeof generation !== 'object') return undefined
  const next: GenerationParams = {}
  if (typeof generation.temperature === 'number') next.temperature = generation.temperature
  if (typeof generation.topP === 'number') next.topP = generation.topP
  if (typeof generation.maxTokens === 'number') next.maxTokens = generation.maxTokens
  return Object.keys(next).length ? next : undefined
}

function scrubSelectedModel(raw: unknown): SelectedModel | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  if (typeof item.slotId !== 'string' || typeof item.modelId !== 'string') return null
  if (typeof item.provider !== 'string' || !PROVIDERS.includes(item.provider as ProviderId)) return null
  return {
    slotId: item.slotId,
    provider: item.provider as ProviderId,
    modelId: item.modelId,
  }
}

function scrubMetrics(raw: unknown): StreamMetrics {
  const metrics = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    latencyMs: typeof metrics.latencyMs === 'number' ? metrics.latencyMs : 0,
    ttftMs: typeof metrics.ttftMs === 'number' ? metrics.ttftMs : null,
    inputTokens: typeof metrics.inputTokens === 'number' ? metrics.inputTokens : 0,
    outputTokens: typeof metrics.outputTokens === 'number' ? metrics.outputTokens : 0,
    costUsd: typeof metrics.costUsd === 'number' ? metrics.costUsd : 0,
  }
}

function scrubAssertionResults(raw: unknown): AssertionResult[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const results: AssertionResult[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.ruleId !== 'string' || typeof row.kind !== 'string') continue
    if (typeof row.pass !== 'boolean' || typeof row.message !== 'string') continue
    results.push({
      ruleId: row.ruleId,
      kind: row.kind as AssertionResult['kind'],
      pass: row.pass,
      message: row.message,
    })
  }
  return results.length ? results : undefined
}

function scrubResponse(raw: unknown): ModelResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  if (typeof item.slotId !== 'string' || typeof item.modelId !== 'string') return null
  if (typeof item.provider !== 'string' || !PROVIDERS.includes(item.provider as ProviderId)) return null
  const status = typeof item.status === 'string' && STATUSES.includes(item.status as StreamStatus)
    ? item.status as StreamStatus
    : 'idle'
  return {
    slotId: item.slotId,
    provider: item.provider as ProviderId,
    modelId: item.modelId,
    content: typeof item.content === 'string' ? item.content : '',
    status,
    metrics: scrubMetrics(item.metrics),
    error: typeof item.error === 'string' ? item.error : undefined,
    assertionResults: scrubAssertionResults(item.assertionResults),
  }
}

function scrubHistoryEntry(raw: unknown): ExecutionHistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.systemPrompt !== 'string' || typeof item.userPrompt !== 'string') {
    return null
  }
  const models = Array.isArray(item.models)
    ? item.models.map(scrubSelectedModel).filter((m): m is SelectedModel => !!m)
    : []
  const responses = Array.isArray(item.responses)
    ? item.responses.map(scrubResponse).filter((r): r is ModelResponse => !!r)
    : []
  const summary = item.assertionSummary
  const assertionSummary: AssertionSummary | undefined
    = summary === 'pass' || summary === 'fail' || summary === 'none'
      ? summary
      : undefined
  return {
    id: item.id,
    systemPrompt: item.systemPrompt,
    userPrompt: item.userPrompt,
    variables: scrubVariables(item.variables as PromptVariables | undefined),
    models,
    responses,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    assertionSummary,
  }
}

function scrubRevision(raw: unknown): PromptRevision | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  if (typeof item.systemPrompt !== 'string' || typeof item.userPrompt !== 'string') return null
  return {
    version: typeof item.version === 'number' ? item.version : 1,
    systemPrompt: item.systemPrompt,
    userPrompt: item.userPrompt,
    variables: scrubVariables(item.variables as PromptVariables | undefined),
    generation: scrubGeneration(item.generation as GenerationParams | undefined),
    savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date().toISOString(),
  }
}

function scrubSavedPrompt(raw: unknown): SavedPrompt | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.name !== 'string') return null
  if (typeof item.systemPrompt !== 'string' || typeof item.userPrompt !== 'string') return null
  const provider = typeof item.provider === 'string' && PROVIDERS.includes(item.provider as ProviderId)
    ? item.provider as ProviderId
    : undefined
  const revisions = Array.isArray(item.revisions)
    ? item.revisions.map(scrubRevision).filter((r): r is PromptRevision => !!r)
    : []
  return {
    id: item.id,
    name: item.name,
    systemPrompt: item.systemPrompt,
    userPrompt: item.userPrompt,
    tags: Array.isArray(item.tags) ? item.tags.filter((t): t is string => typeof t === 'string') : [],
    version: typeof item.version === 'number' ? item.version : 1,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
    variables: scrubVariables(item.variables as PromptVariables | undefined),
    model: typeof item.model === 'string' ? item.model : undefined,
    provider,
    generation: scrubGeneration(item.generation as GenerationParams | undefined),
    revisions,
  }
}

/** Build a versioned backup payload; API keys / vault material are never included. */
export function createPromptBackup(
  history: ExecutionHistoryEntry[],
  savedPrompts: SavedPrompt[],
  exportedAt = new Date().toISOString(),
): PromptBackupPayload {
  return {
    version: PROMPT_BACKUP_VERSION,
    exportedAt,
    history: history.map(entry => scrubHistoryEntry(entry)!).filter(Boolean),
    savedPrompts: savedPrompts.map(prompt => scrubSavedPrompt(prompt)!).filter(Boolean),
  }
}

export function serializePromptBackup(payload: PromptBackupPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`
}

export function parsePromptBackup(raw: string): PromptBackupPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    throw new PromptBackupError('Invalid JSON backup file')
  }

  const result = v.safeParse(promptBackupSchema, parsed)
  if (!result.success) {
    throw new PromptBackupError(firstSchemaIssue(result.issues))
  }

  const body = result.output
  const history = (body.history ?? [])
    .map(scrubHistoryEntry)
    .filter((e): e is ExecutionHistoryEntry => !!e)
  const savedPrompts = (body.savedPrompts ?? [])
    .map(scrubSavedPrompt)
    .filter((p): p is SavedPrompt => !!p)

  return {
    version: PROMPT_BACKUP_VERSION,
    exportedAt: typeof body.exportedAt === 'string' ? body.exportedAt : new Date().toISOString(),
    history,
    savedPrompts,
  }
}

export function mergePromptBackup(
  current: { history: ExecutionHistoryEntry[], savedPrompts: SavedPrompt[] },
  incoming: PromptBackupPayload,
): { history: ExecutionHistoryEntry[], savedPrompts: SavedPrompt[] } {
  const historyById = new Map(current.history.map(e => [e.id, e]))
  for (const entry of incoming.history) {
    historyById.set(entry.id, entry)
  }

  const savedById = new Map(current.savedPrompts.map(p => [p.id, p]))
  for (const prompt of incoming.savedPrompts) {
    savedById.set(prompt.id, prompt)
  }

  const history = [...historyById.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const savedPrompts = [...savedById.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return {
    history: history.slice(0, 100),
    savedPrompts,
  }
}

/** Serialize history + saved prompts to a JSON backup string. */
export function exportPromptBackupJson(
  history: ExecutionHistoryEntry[],
  savedPrompts: SavedPrompt[],
): string {
  return serializePromptBackup(createPromptBackup(history, savedPrompts))
}

export interface ApplyPromptBackupResult {
  history: ExecutionHistoryEntry[]
  savedPrompts: SavedPrompt[]
  imported: { history: number, savedPrompts: number }
}

/** Parse a backup and apply replace or merge against the current store slices. */
export function applyPromptBackupImport(
  current: { history: ExecutionHistoryEntry[], savedPrompts: SavedPrompt[] },
  raw: string,
  mode: PromptBackupMode,
): ApplyPromptBackupResult {
  const payload = parsePromptBackup(raw)
  const imported = {
    history: payload.history.length,
    savedPrompts: payload.savedPrompts.length,
  }

  if (mode === 'replace') {
    return {
      history: payload.history.slice(0, 100),
      savedPrompts: payload.savedPrompts,
      imported,
    }
  }

  const merged = mergePromptBackup(current, payload)
  return {
    history: merged.history,
    savedPrompts: merged.savedPrompts,
    imported,
  }
}

export interface SavedPromptDraft {
  systemPrompt: string
  userPrompt: string
  variables: PromptVariables
  generation: GenerationParams
}

export interface UpsertSavedPromptResult {
  savedPrompts: SavedPrompt[]
  prompt: SavedPrompt
}

/** Create or version-bump a named saved prompt; returns the updated list + prompt. */
export function upsertSavedPrompt(
  savedPrompts: SavedPrompt[],
  draft: SavedPromptDraft,
  name: string,
  tags: string[] = [],
  meta: { model?: string, provider?: ProviderId } = {},
  options: { now?: string, createId: () => string },
): UpsertSavedPromptResult {
  const now = options.now ?? new Date().toISOString()
  const existing = savedPrompts.find(p => p.name === name)

  if (existing) {
    const prompt: SavedPrompt = {
      ...existing,
      revisions: [
        ...(existing.revisions ?? []),
        {
          version: existing.version,
          systemPrompt: existing.systemPrompt,
          userPrompt: existing.userPrompt,
          variables: { ...(existing.variables ?? {}) },
          generation: existing.generation,
          savedAt: existing.updatedAt,
        },
      ],
      systemPrompt: draft.systemPrompt,
      userPrompt: draft.userPrompt,
      variables: { ...draft.variables },
      generation: { ...draft.generation },
      model: meta.model ?? existing.model,
      provider: meta.provider ?? existing.provider,
      tags,
      version: existing.version + 1,
      updatedAt: now,
    }
    return {
      savedPrompts: savedPrompts.map(p => (p.id === existing.id ? prompt : p)),
      prompt,
    }
  }

  const prompt: SavedPrompt = {
    id: options.createId(),
    name,
    systemPrompt: draft.systemPrompt,
    userPrompt: draft.userPrompt,
    tags,
    version: 1,
    createdAt: now,
    updatedAt: now,
    variables: { ...draft.variables },
    model: meta.model,
    provider: meta.provider,
    generation: { ...draft.generation },
    revisions: [],
  }
  return {
    savedPrompts: [prompt, ...savedPrompts],
    prompt,
  }
}
