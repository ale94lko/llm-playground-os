/**
 * Copyright (c) 2026 llm-workbench contributors
 * SPDX-License-Identifier: MIT
 */
// Vitest config for `npm run test:offline`: the full suite under network
// denial. Extends the main config with tests/offline.setup.ts, which makes
// every non-loopback connection throw (fetch, net, tls, dns). Cross-platform
// — no unshare/iptables needed, so the same proof runs locally on Windows
// and in CI on Linux.
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

const offlineSetup = fileURLToPath(new URL('./tests/offline.setup.ts', import.meta.url))
const baseSetup = fileURLToPath(new URL('./tests/setup.ts', import.meta.url))

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: [baseSetup, offlineSetup],
    },
  }),
)
