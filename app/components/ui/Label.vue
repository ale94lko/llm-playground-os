<script setup lang="ts">
defineProps<{ for?: string }>()
</script>

<template>
  <label :for="for" class="text-sm font-medium text-foreground">
    <slot />
  </label>
</template>
