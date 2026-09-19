// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { StreamMetrics } from '~/types/llm'

/** Initial metrics before any tokens arrive. */
export function createInitialMetrics(inputTokens: number, costUsd: number): StreamMetrics {
  return {
    latencyMs: 0,
    ttftMs: null,
    inputTokens,
    outputTokens: 0,
    costUsd,
  }
}

/**
 * Build stream metrics from a base snapshot plus incremental updates
 * (latency, output tokens, cost, TTFT).
 */
export function buildMetrics(
  base: StreamMetrics,
  patch: Partial<Pick<StreamMetrics, 'latencyMs' | 'ttftMs' | 'outputTokens' | 'costUsd'>> = {},
): StreamMetrics {
  return {
    ...base,
    ...patch,
  }
}
