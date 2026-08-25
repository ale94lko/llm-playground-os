<script setup lang="ts">
import { BarChart3, Cpu, History, Menu, Settings, X } from '@lucide/vue'

const route = useRoute()
const menuOpen = ref(false)

const links = [
  { to: '/', label: 'Playground', icon: Cpu },
  { to: '/history', label: 'History', icon: History },
  { to: '/metrics', label: 'Metrics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

watch(() => route.path, () => {
  menuOpen.value = false
})

watch(menuOpen, (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
})

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
    <div class="flex h-14 items-center gap-2 px-4 lg:px-6">
      <UiButton
        variant="ghost"
        size="sm"
        class="sm:hidden shrink-0 -ml-1"
        aria-label="Open menu"
        @click="menuOpen = true"
      >
        <Menu class="h-5 w-5" />
      </UiButton>

      <NuxtLink to="/" class="flex min-w-0 items-center gap-2 font-semibold text-foreground">
        <Cpu class="h-5 w-5 shrink-0 text-primary" />
        <span class="truncate">LLM Playground OS</span>
      </NuxtLink>

      <nav class="ml-auto hidden items-center gap-1 sm:flex">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="route.path === link.to
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
        >
          <component :is="link.icon" class="h-4 w-4" />
          {{ link.label }}
        </NuxtLink>
      </nav>
    </div>

    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="fixed inset-0 z-50 sm:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="menuOpen = false"
        />

        <aside class="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background shadow-xl">
          <div class="flex h-14 items-center justify-between border-b border-border px-4">
            <div class="flex items-center gap-2 font-semibold">
              <Cpu class="h-5 w-5 text-primary" />
              <span>Menu</span>
            </div>
            <UiButton
              variant="ghost"
              size="sm"
              aria-label="Close menu"
              @click="menuOpen = false"
            >
              <X class="h-5 w-5" />
            </UiButton>
          </div>

          <nav class="flex flex-col gap-1 p-3">
            <NuxtLink
              v-for="link in links"
              :key="link.to"
              :to="link.to"
              class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors"
              :class="route.path === link.to
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
              @click="menuOpen = false"
            >
              <component :is="link.icon" class="h-4 w-4" />
              {{ link.label }}
            </NuxtLink>
          </nav>
        </aside>
      </div>
    </Teleport>
  </header>
</template>
