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
})
