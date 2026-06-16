/**
 * vitest 配置文件
 *
 * 不引入额外基础设施(无容器/无 DB):
 * - 直接 vitest 跑 server/ 下的纯函数模块
 * - 路径别名沿用 Nuxt 的 #shared(由 .nuxt 注入)
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // 单测失败时也允许继续跑
    bail: 0,
  },
  resolve: {
    alias: {
      "~~": fileURLToPath(new URL("./", import.meta.url)),
      "@@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
