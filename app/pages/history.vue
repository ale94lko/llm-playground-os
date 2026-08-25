<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { Bookmark, Clock, Trash2 } from '@lucide/vue'

const promptStore = usePromptStore()

const activeTab = ref<'history' | 'saved'>('history')
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">History & Library</h1>
      <p class="text-sm text-muted-foreground">Past executions and saved prompt collections</p>
    </div>

    <div class="flex gap-2">
      <UiButton
        :variant="activeTab === 'history' ? 'default' : 'outline'"
        size="sm"
        @click="activeTab = 'history'"
      >
        <Clock class="h-4 w-4" />
        History ({{ promptStore.history.length }})
      </UiButton>
      <UiButton
        :variant="activeTab === 'saved' ? 'default' : 'outline'"
        size="sm"
        @click="activeTab = 'saved'"
      >
        <Bookmark class="h-4 w-4" />
        Saved ({{ promptStore.savedPrompts.length }})
      </UiButton>
    </div>

    <div v-if="activeTab === 'history'" class="space-y-3">
      <div v-if="!promptStore.history.length" class="text-center py-12 text-muted-foreground">
        No executions yet. Run a prompt from the Playground.
      </div>
      <UiCard
        v-for="entry in promptStore.history"
        :key="entry.id"
        class="p-4 hover:border-primary/40 transition-colors cursor-pointer"
        @click="promptStore.loadFromHistory(entry.id)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">{{ entry.userPrompt }}</p>
            <p class="text-xs text-muted-foreground mt-1">
              {{ new Date(entry.createdAt).toLocaleString() }} · {{ entry.models.length }} model(s)
            </p>
          </div>
          <UiButton variant="outline" size="sm" @click.stop="navigateTo('/')">
            Load
          </UiButton>
        </div>
      </UiCard>
      <div v-if="promptStore.history.length" class="flex justify-end">
        <UiButton variant="outline" size="sm" @click="promptStore.clearHistory()">
          <Trash2 class="h-4 w-4" />
          Clear history
        </UiButton>
      </div>
    </div>

    <div v-else class="space-y-3">
      <div v-if="!promptStore.savedPrompts.length" class="text-center py-12 text-muted-foreground">
        No saved prompts yet.
      </div>
      <UiCard
        v-for="prompt in promptStore.savedPrompts"
        :key="prompt.id"
        class="p-4"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium">{{ prompt.name }}</p>
              <UiBadge variant="secondary">v{{ prompt.version }}</UiBadge>
            </div>
            <p class="text-xs text-muted-foreground mt-1 truncate">{{ prompt.userPrompt }}</p>
            <div v-if="prompt.tags.length" class="flex gap-1 mt-2">
              <UiBadge v-for="tag in prompt.tags" :key="tag" variant="secondary">{{ tag }}</UiBadge>
            </div>
          </div>
          <div class="flex gap-2">
            <UiButton variant="outline" size="sm" @click="promptStore.loadPrompt(prompt.id); navigateTo('/')">
              Load
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="promptStore.deleteSavedPrompt(prompt.id)">
              <Trash2 class="h-4 w-4" />
            </UiButton>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>
