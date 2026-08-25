export default defineNuxtPlugin(async () => {
  const provider = useProviderStore()
  const security = useSecurityStore()

  provider.migrateLegacyStorage()
  provider.migrateDeprecatedModels()
  await security.bootstrapKeys()
})
