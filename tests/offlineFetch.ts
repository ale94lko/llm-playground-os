// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { vi } from 'vitest'

/**
 * Default `fetch` for the unit suite: fail closed on any network call.
 * Specs that exercise HTTP stub `vi.stubGlobal('fetch', …)` (or inject `fetchImpl`).
 * Re-install after `vi.unstubAllGlobals()` so the suite stays offline.
 */
export function installOfflineFetchGuard(): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
    throw new TypeError(
      `Offline unit suite blocked fetch(${url}). Stub fetch or inject fetchImpl (see docs/dev-notes.md).`,
    )
  }))
}
