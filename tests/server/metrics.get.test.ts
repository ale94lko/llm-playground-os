// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadHandler, stubNitroGlobals } from './nitroTestUtils'
import { installOfflineFetchGuard } from '../offlineFetch'

describe('server/api/metrics.get', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    installOfflineFetchGuard()
  })

  it('returns the full runtime metrics snapshot including counters', async () => {
    stubNitroGlobals()
    const {
      recordStreamRequest,
      recordStreamError,
      resetRuntimeMetrics,
      getRuntimeMetrics,
    } = await import('~/lib/runtimeMetrics')

    resetRuntimeMetrics()
    recordStreamRequest()
    recordStreamRequest()
    recordStreamError()

    const handler = await loadHandler('../../server/api/metrics.get')
    const result = await handler({})

    expect(result).toMatchObject({
      status: 'ok',
      streamRequests: 2,
      streamErrors: 1,
      uptimeMs: expect.any(Number),
      timestamp: expect.any(String),
    })
    expect(getRuntimeMetrics().streamRequests).toBe(2)
  })
})
