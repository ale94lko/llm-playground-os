import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Local-first app: state lives in localStorage/sessionStorage
  ssr: false,

  modules: ['@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      title: 'LLM Playground OS',
      meta: [
        { name: 'description', content: 'Open-source multi-LLM playground for developers' },
      ],
    },
  },

  pinia: {
    storesDirs: ['stores/**'],
  },
})
