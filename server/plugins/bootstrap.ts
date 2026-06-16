/**
 * 服务端插件:Nuxt 启动钩子
 * - 冷启动时 bootstrap admin 用户(从 env 读)
 * - 如果 data/users.json 存在则完全不动
 */
import { bootstrapAdmin } from "../core/user-store";

export default defineNitroPlugin(async () => {
  try {
    await bootstrapAdmin();
  } catch (err) {
    console.error("[server-plugin] bootstrap admin failed:", err);
  }
});
