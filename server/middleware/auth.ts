/**
 * 服务端中间件:按"路径前缀 + 方法"映射到所需权限
 * - 路径不在 PROTECTED 列表中 → 放行
 * - 路径命中 → 调用 requirePermission,未登录 401 / 权限不足 403
 *
 * 权限点见 server/core/rbac.ts
 */
import { requirePermission, type Permission } from "../core/auth";

// 路径前缀 + 方法 → 所需权限
// 写法:"POST /api/blog/posts" 需要 blog:create
const PROTECTED: Array<{
  prefix: string;
  methods: Set<string>;
  perm: Permission;
}> = [
  // 博客
  {
    prefix: "/api/blog/posts",
    methods: new Set(["POST"]),
    perm: "blog:create",
  },
  {
    prefix: "/api/blog/posts",
    methods: new Set(["PUT", "PATCH"]),
    perm: "blog:update",
  },
  {
    prefix: "/api/blog/posts",
    methods: new Set(["DELETE"]),
    perm: "blog:delete",
  },
  // 向量
  {
    prefix: "/api/blog/vectorize",
    methods: new Set(["POST"]),
    perm: "vectorize:run",
  },
  {
    prefix: "/api/blog/vectorize",
    methods: new Set(["DELETE"]),
    perm: "vectorize:delete",
  },
  // 用户管理
  { prefix: "/api/users", methods: new Set(["GET"]), perm: "user:list" },
  { prefix: "/api/users", methods: new Set(["POST"]), perm: "user:create" },
  {
    prefix: "/api/users",
    methods: new Set(["PUT", "PATCH"]),
    perm: "user:update",
  },
  { prefix: "/api/users", methods: new Set(["DELETE"]), perm: "user:delete" },
  // 综述生成(写操作,需要 review:generate)
  {
    prefix: "/api/literature-review",
    methods: new Set(["POST"]),
    perm: "review:generate",
  },
];

export default defineEventHandler((event) => {
  const method = getMethod(event);
  const path = getRequestURL(event).pathname;

  // 认证/登出本身放行
  if (path.startsWith("/api/auth/")) return;

  for (const rule of PROTECTED) {
    if (path.startsWith(rule.prefix) && rule.methods.has(method)) {
      requirePermission(event, rule.perm);
      return;
    }
  }
});
