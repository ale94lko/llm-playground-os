<script setup lang="ts">
const promptStore = usePromptStore()

watch(
  () => [promptStore.systemPrompt, promptStore.userPrompt],
  () => promptStore.syncVariablesFromPrompts(),
  { immediate: true },
)
</script>

<template>
  <div class="space-y-4">
    <div>
      <UiLabel class="mb-1.5 block">System Prompt</UiLabel>
      <UiTextarea
        v-model="promptStore.systemPrompt"
        placeholder="You are a helpful assistant..."
        :rows="3"
      />
    </div>
    <div>
      <UiLabel class="mb-1.5 block">User Prompt</UiLabel>
      <UiTextarea
        v-model="promptStore.userPrompt"
        placeholder="Write your prompt with {{variables}}..."
        :rows="6"
      />
      <p class="mt-1.5 text-xs text-muted-foreground">
        Use <code class="rounded bg-muted px-1">{<!-- -->{variable_name}}</code> for dynamic variables.
      </p>
    </div>
  </div>
</template>
