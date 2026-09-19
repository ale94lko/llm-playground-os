// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import { buildOfflineTestPlan } from '../scripts/test-offline.mjs'
import { installOfflineFetchGuard } from './offlineFetch'

describe('test-offline plan', () => {
  it('uses unshare network denial on Linux when available', () => {
    const plan = buildOfflineTestPlan({
      platform: 'linux',
      hasUnshare: true,
      npmArgs: ['test'],
    })
    expect(plan.mode).toBe('unshare')
    expect(plan.command).toBe('unshare')
    expect(plan.args).toEqual(['--user', '--map-root-user', '--net', '--', 'npm', 'test'])
  })

  it('falls back to npm-only on Windows (fetch-guard mode)', () => {
    const plan = buildOfflineTestPlan({
      platform: 'win32',
      hasUnshare: false,
      npmArgs: ['run', 'test:coverage'],
    })
    expect(plan.mode).toBe('fetch-guard-only')
    expect(plan.command).toBe('npm')
    expect(plan.args).toEqual(['run', 'test:coverage'])
    expect(plan.shell).toBe(true)
  })
})

describe('offlineFetch guard', () => {
  it('rejects unmocked fetch calls', async () => {
    installOfflineFetchGuard()
    await expect(fetch('https://api.openai.com/v1/chat/completions')).rejects.toThrow(/Offline unit suite blocked fetch/)
  })

  it('allows an explicit stub to override the guard', async () => {
    installOfflineFetchGuard()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })))
    const res = await fetch('https://api.openai.com/v1/chat/completions')
    expect(await res.text()).toBe('ok')
  })
})
