// 统一日志入口
// - 包装 consola,确保级别按 NODE_ENV 切换
// - 服务器端默认 info,开发/测试用 debug
// - 显式声明 consola 依赖(Nuxt 传递依赖 → 项目直接依赖,见 package.json)

import { consola } from "consola";

const level =
  process.env.NODE_ENV === "production" ? 3 /* info */ : 4; /* debug */
consola.level = level;

// 统一 tag,所有日志带 [curata] 前缀,便于 grep
const tagged = consola.withTag("curata");

export const logger = {
  debug: (...args: [unknown, ...unknown[]]) => tagged.debug(...args),
  info: (...args: [unknown, ...unknown[]]) => tagged.info(...args),
  warn: (...args: [unknown, ...unknown[]]) => tagged.warn(...args),
  error: (...args: [unknown, ...unknown[]]) => tagged.error(...args),
  success: (...args: [unknown, ...unknown[]]) => tagged.success(...args),
};

export type Logger = typeof logger;
