<script setup lang="ts">
const promptStore = usePromptStore()
</script>

<template>
  <UiCard v-if="promptStore.detectedVariables.length" class="p-4">
    <h3 class="text-sm font-medium mb-3">Variables</h3>
    <div class="grid gap-3 sm:grid-cols-2">
      <div v-for="name in promptStore.detectedVariables" :key="name">
        <UiLabel :for="`var-${name}`" class="mb-1 block capitalize">{{ name }}</UiLabel>
        <UiInput
          :id="`var-${name}`"
          :model-value="promptStore.variables[name] ?? ''"
          :placeholder="`Value for ${name}`"
          @update:model-value="promptStore.setVariable(name, $event)"
        />
      </div>
    </div>
  </UiCard>
</template>
