/**
 * Copyright (c) 2026 llm-workbench contributors
 * SPDX-License-Identifier: MIT
 */
// Network-denial setup for `npm run test:offline` (see docs/dev-notes.md).
//
// Loaded IN ADDITION to tests/setup.ts via vitest.offline.config.ts. Any real
// outbound connection attempt — fetch, net, tls, dns — throws immediately
// unless it targets loopback (127.0.0.1 / ::1 / localhost). This is the
// cross-platform equivalent of `unshare -n`: the suite runs with the network
// stack present but unusable, on Linux, macOS, Windows, and CI alike.
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'

const LOOPBACK = /^(localhost|127\.|::1|\[::1\])/i

function assertLoopback(host: unknown, what: string): void {
  const h = String(host ?? '')
  if (!LOOPBACK.test(h)) {
    throw new Error(
      `offline suite: blocked ${what} to "${h}". ` +
        'Mock it (vi.fn / vi.spyOn / vi.stubGlobal) — the unit suite must never hit the network.',
    )
  }
}

// fetch (undici global)
const realFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
  assertLoopback(new URL(url).hostname, 'fetch')
  return realFetch(input, init)
}) as typeof fetch

// node:net / node:tls sockets
const realConnect = net.connect
net.connect = function patched(this: unknown, ...args: unknown[]) {
  const opts = args[0]
  const host = typeof opts === 'object' && opts !== null ? (opts as { host?: string }).host : undefined
  assertLoopback(host, 'net.connect')
  return (realConnect as (...a: unknown[]) => unknown).apply(this, args)
} as typeof net.connect
tls.connect = net.connect as unknown as typeof tls.connect

// node:dns resolution
const realLookup = dns.lookup
dns.lookup = function patched(hostname: string, ...rest: unknown[]) {
  assertLoopback(hostname, 'dns.lookup')
  return (realLookup as (h: string, ...r: unknown[]) => unknown).call(dns, hostname, ...rest)
} as typeof dns.lookup

export {}
