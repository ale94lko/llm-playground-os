export default defineNuxtPlugin(() => {
  const provider = useProviderStore()
  provider.migrateLegacyStorage()
  provider.migrateDeprecatedModels()
})
