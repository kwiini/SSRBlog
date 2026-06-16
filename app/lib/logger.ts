// 浏览器端统一日志入口
// - 同 consola,但用 import.meta.env.DEV 判断 dev/prod
// - 客户端日志在生产构建时不会自动 tree-shake
//   要用级别守卫。这里直接按 env 设级别即可。

import { consola } from "consola";

const isDev = (import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV;
consola.level = isDev ? 4 /* debug */ : 3 /* info */;

const tagged = consola.withTag("curata");

export const logger = {
  debug: (...args: [unknown, ...unknown[]]) => tagged.debug(...args),
  info: (...args: [unknown, ...unknown[]]) => tagged.info(...args),
  warn: (...args: [unknown, ...unknown[]]) => tagged.warn(...args),
  error: (...args: [unknown, ...unknown[]]) => tagged.error(...args),
  success: (...args: [unknown, ...unknown[]]) => tagged.success(...args),
};

export type Logger = typeof logger;
