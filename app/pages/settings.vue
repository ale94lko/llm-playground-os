<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Settings</h1>
      <p class="text-sm text-muted-foreground">Configure API keys and provider endpoints</p>
    </div>
    <SettingsApiKeyManager />
  </div>
</template>
