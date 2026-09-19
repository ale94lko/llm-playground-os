// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from 'vue'
import { beforeEach, vi } from 'vitest'
import { useCodeExporter } from '../app/composables/useCodeExporter'
import { useCompareRunner } from '../app/composables/useCompareRunner'
import { useCostCalculator } from '../app/composables/useCostCalculator'
import { usePromptStore } from '../app/stores/usePromptStore'
import { useLocalDiscoveryStore } from '../app/stores/useLocalDiscoveryStore'
import { useModelSlotsStore } from '../app/stores/useModelSlotsStore'
import { useProviderStore } from '../app/stores/useProviderStore'
import { useSecurityStore } from '../app/stores/useSecurityStore'
import { useVaultStore } from '../app/stores/useVaultStore'
import { installOfflineFetchGuard } from './offlineFetch'

vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('watch', watch)
vi.stubGlobal('watchEffect', watchEffect)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useCostCalculator', useCostCalculator)
vi.stubGlobal('useCodeExporter', useCodeExporter)
vi.stubGlobal('useCompareRunner', useCompareRunner)
vi.stubGlobal('usePromptStore', usePromptStore)
vi.stubGlobal('useProviderStore', useProviderStore)
vi.stubGlobal('useSecurityStore', useSecurityStore)
vi.stubGlobal('useVaultStore', useVaultStore)
vi.stubGlobal('useModelSlotsStore', useModelSlotsStore)
vi.stubGlobal('useLocalDiscoveryStore', useLocalDiscoveryStore)

const memory = new Map<string, string>()
const sessionMemory = new Map<string, string>()

function storageStub(store: Map<string, string>): Storage {
  return {
    get length() {
      return store.size
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
  }
}

beforeEach(() => {
  memory.clear()
  sessionMemory.clear()
  vi.stubGlobal('localStorage', storageStub(memory))
  vi.stubGlobal('sessionStorage', storageStub(sessionMemory))
  installOfflineFetchGuard()
})
