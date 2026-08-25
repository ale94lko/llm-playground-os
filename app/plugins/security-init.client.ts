export default defineNuxtPlugin(() => {
  useProviderStore().migrateLegacyStorage()
})
