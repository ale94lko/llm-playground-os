<script setup lang="ts">
import type { ModelResponse } from '~/types/llm'

defineProps<{ responses: ModelResponse[] }>()

const gridClass = computed(() => {
  return (count: number) => {
    if (count <= 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-1 lg:grid-cols-2'
    return 'grid-cols-1 lg:grid-cols-2'
  }
})
</script>

<template>
  <div
    class="grid gap-4"
    :class="gridClass(responses.length)"
  >
    <PlaygroundResponseCard
      v-for="response in responses"
      :key="response.slotId"
      :response="response"
    />
  </div>
</template>
