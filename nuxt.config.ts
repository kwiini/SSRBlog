// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/content'
  ],
  content: {
    // 配置内容模块
    // 使用默认配置，content 目录会自动被扫描
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
})
