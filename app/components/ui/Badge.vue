<script setup lang="ts">
import { cn } from '~/lib/utils'

defineProps<{
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error'
}>()

const variants = {
  default: 'bg-primary/20 text-primary border-primary/30',
  secondary: 'bg-muted text-muted-foreground border-border',
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
}
</script>

<template>
  <span
    :class="cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
      variants[variant ?? 'default'],
    )"
  >
    <slot />
  </span>
</template>
