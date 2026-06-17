/**
 * @nuxt/content v3 collection 定义
 *
 * 单一 collection:"content"
 * - 源目录: content/articles/**
 * - 路径前缀: /articles
 * - 类型: page(可与 NuxtPage 路由对应)
 *
 */
import { defineCollection, defineContentConfig } from "@nuxt/content";

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: "page",
      source: {
        include: "articles/**",
        prefix: "/articles",
      },
    }),
  },
});
