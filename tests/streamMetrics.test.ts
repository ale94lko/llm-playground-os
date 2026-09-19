// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { buildMetrics, createInitialMetrics } from '../app/lib/streamMetrics'

describe('streamMetrics', () => {
  it('creates initial metrics with zero latency and output', () => {
    const metrics = createInitialMetrics(42, 0.001)
    expect(metrics).toEqual({
      latencyMs: 0,
      ttftMs: null,
      inputTokens: 42,
      outputTokens: 0,
      costUsd: 0.001,
    })
  })

  it('builds metrics by patching latency, tokens, and cost', () => {
    const base = createInitialMetrics(10, 0.0001)
    const metrics = buildMetrics(base, {
      latencyMs: 250,
      outputTokens: 20,
      costUsd: 0.0005,
      ttftMs: 40,
    })
    expect(metrics).toEqual({
      latencyMs: 250,
      ttftMs: 40,
      inputTokens: 10,
      outputTokens: 20,
      costUsd: 0.0005,
    })
  })

  it('preserves base fields when patch is empty or partial', () => {
    const base = createInitialMetrics(8, 0.002)
    base.ttftMs = 15
    expect(buildMetrics(base)).toEqual(base)
    expect(buildMetrics(base, { latencyMs: 100 })).toEqual({
      ...base,
      latencyMs: 100,
    })
  })
})
