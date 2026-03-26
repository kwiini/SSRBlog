// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/content'
  ],
  content: {
    sources: {
      content: {
        driver: 'fs',
        prefix: '/articles',
        base: 'content/articles'
      }
    }
  },
  css: [
    '~/assets/css/main.css'
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    // 服务器端私有配置
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseURL: process.env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    llmModel: process.env.LLM_MODEL || 'qwen-max',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-v3',
  },
  nitro: {
    preset: "vercel"
  },
})
