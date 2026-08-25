<script setup lang="ts">
import { cn } from '~/lib/utils'
import { X } from '@lucide/vue'

defineProps<{ open: boolean; title?: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/60" @click="$emit('close')" />
      <div :class="cn('relative z-10 w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl mx-4')">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">{{ title }}</h2>
          <button class="text-muted-foreground hover:text-foreground" @click="$emit('close')">
            <X class="h-5 w-5" />
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
