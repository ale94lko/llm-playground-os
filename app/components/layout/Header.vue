<script setup lang="ts">
import { BarChart3, Cpu, History, Settings } from '@lucide/vue'

const route = useRoute()

const links = [
  { to: '/', label: 'Playground', icon: Cpu },
  { to: '/history', label: 'History', icon: History },
  { to: '/metrics', label: 'Metrics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
    <div class="flex h-14 items-center justify-between px-4 lg:px-6">
      <div class="flex items-center gap-6">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold text-foreground">
          <Cpu class="h-5 w-5 text-primary" />
          <span>LLM Playground OS</span>
        </NuxtLink>
        <nav class="hidden sm:flex items-center gap-1">
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
      <UiBadge variant="secondary">Local-first · Privacy</UiBadge>
    </div>
  </header>
</template>
