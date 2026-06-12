/**
 * 服务端中间件：保护管理员接口
 * - /api/posts          → 写操作（POST/PUT/DELETE）需认证
 * - /api/blog-vectorize → 写操作（POST/DELETE）需认证
 * - /api/auth/*         → 放行（登录/登出/检查）
 * - 其他接口            → 放行
 */
import { requireAuth } from "../utils/auth";

// 需要认证的路径前缀 + 方法
const PROTECTED: Array<{ prefix: string; methods: Set<string> }> = [
  { prefix: "/api/posts", methods: new Set(["POST", "PUT", "DELETE"]) },
  { prefix: "/api/blog-vectorize", methods: new Set(["POST", "DELETE"]) },
];

export default defineEventHandler((event) => {
  const method = getMethod(event);
  const path = getRequestURL(event).pathname;

  // 认证接口本身放行
  if (path.startsWith("/api/auth/")) return;

  for (const rule of PROTECTED) {
    if (path.startsWith(rule.prefix) && rule.methods.has(method)) {
      requireAuth(event); // 未认证则抛 401
      return;
    }
  }
});
