#!/usr/bin/env node
// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

/**
 * Prove the Vitest unit suite does not need live network / Ollama.
 *
 * On Linux (CI): run `npm test` (or forwarded args) inside a network namespace
 * via `unshare --user --map-root-user --net`.
 *
 * On Windows/macOS (local): run the same npm command without unshare; the
 * suite still fails closed via `tests/offlineFetch.ts` + per-spec stubs.
 * Full network-namespace denial is enforced on ubuntu-latest CI.
 *
 * Usage:
 *   node scripts/test-offline.mjs
 *   node scripts/test-offline.mjs --coverage
 *   npm run test:offline
 *   npm run test:offline -- --coverage
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'

/**
 * @param {{ platform?: NodeJS.Platform, hasUnshare?: boolean, npmArgs?: string[] }} [opts]
 */
export function buildOfflineTestPlan(opts = {}) {
  const platform = opts.platform ?? process.platform
  const hasUnshare = opts.hasUnshare ?? false
  const npmArgs = opts.npmArgs?.length ? opts.npmArgs : ['test']

  if (platform === 'linux' && hasUnshare) {
    return {
      mode: 'unshare',
      command: 'unshare',
      args: ['--user', '--map-root-user', '--net', '--', 'npm', ...npmArgs],
      shell: false,
    }
  }

  return {
    mode: 'fetch-guard-only',
    command: 'npm',
    args: npmArgs,
    shell: platform === 'win32',
  }
}

/**
 * @returns {boolean}
 */
export function detectUnshare() {
  if (process.platform !== 'linux') return false
  const probe = spawnSync('unshare', ['--help'], { encoding: 'utf8' })
  return probe.status === 0 || probe.status === 1
}

function parseNpmArgs(argv) {
  const forwarded = argv.slice(2)
  if (!forwarded.length) return ['test']
  if (forwarded[0] === '--coverage') return ['run', 'test:coverage']
  if (forwarded[0] === '--') return forwarded.slice(1).length ? forwarded.slice(1) : ['test']
  // `npm run test:offline -- --coverage` → argv may be ['--coverage'] already
  if (forwarded.includes('--coverage') && forwarded.length === 1) {
    return ['run', 'test:coverage']
  }
  return forwarded[0] === 'test' || forwarded[0] === 'run'
    ? forwarded
    : ['test', ...forwarded]
}

function main() {
  const npmArgs = parseNpmArgs(process.argv)
  const hasUnshare = detectUnshare()
  const plan = buildOfflineTestPlan({ hasUnshare, npmArgs })

  if (process.env.GITHUB_ACTIONS === 'true' && process.platform === 'linux' && plan.mode !== 'unshare') {
    console.error('test-offline: CI on Linux requires unshare for network denial')
    process.exit(1)
  }

  console.log(`test-offline: mode=${plan.mode} → ${plan.command} ${plan.args.join(' ')}`)

  const result = spawnSync(plan.command, plan.args, {
    stdio: 'inherit',
    shell: plan.shell,
    env: process.env,
  })

  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

const invokedDirectly = process.argv[1] && process.argv[1].replaceAll('\\', '/').endsWith('scripts/test-offline.mjs')
if (invokedDirectly) {
  main()
}
