/**
 * RBAC 角色与权限定义
 *
 * 4 个角色:
 *   - admin    : 全部权限(包括系统配置)
 *   - editor   : 内容创作(博客 CRUD、向量重建、RAG、综述生成、评论)
 *   - reviewer : 阅读 + 综述生成 + 评论(无内容写权限)
 *   - viewer   : 只读(RAG 问答 + 读综述)
 *
 * 权限点:
 *   blog:*        博客 CRUD
 *   vectorize:*   向量重建
 *   rag:query     RAG 问答
 *   review:*      综述生成/查看
 *   comment:*     评论
 *   system:*      系统配置(只 admin)
 */

export type Role = "admin" | "editor" | "reviewer" | "viewer";

export type Permission =
  | "blog:create"
  | "blog:update"
  | "blog:delete"
  | "blog:read"
  | "vectorize:run"
  | "vectorize:delete"
  | "rag:query"
  | "rag:chat"
  | "review:generate"
  | "review:read"
  | "comment:create"
  | "system:config"
  | "system:cache:clear";

export const ALL_ROLES: Role[] = ["admin", "editor", "reviewer", "viewer"];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    // 全开
    "blog:create",
    "blog:update",
    "blog:delete",
    "blog:read",
    "vectorize:run",
    "vectorize:delete",
    "rag:query",
    "rag:chat",
    "review:generate",
    "review:read",
    "comment:create",
    "system:config",
    "system:cache:clear",
  ],
  editor: [
    "blog:create",
    "blog:update",
    "blog:delete",
    "blog:read",
    "vectorize:run",
    "vectorize:delete",
    "rag:query",
    "rag:chat",
    "review:generate",
    "review:read",
    "comment:create",
  ],
  reviewer: [
    "blog:read",
    "rag:query",
    "rag:chat",
    "review:generate",
    "review:read",
    "comment:create",
  ],
  viewer: ["blog:read", "rag:query", "rag:chat", "review:read"],
};

/**
 * 角色 → 权限列表(含 * 通配:admin 拿全集,其它角色按 ROLE_PERMISSIONS 表)
 */
export function getPermissionsForRole(role: Role): Permission[] {
  if (role === "admin") return ROLE_PERMISSIONS.admin;
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * 检查角色是否拥有某权限
 * - 单独传入的 "admin" 角色永远通过
 * - "blog:create" 这种精确点按 ROLE_PERMISSIONS 查
 */
export function roleHasPermission(role: Role, perm: Permission): boolean {
  if (role === "admin") return true;
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

/**
 * 校验权限点是否合法
 */
export function isValidPermission(p: string): p is Permission {
  return [
    "blog:create",
    "blog:update",
    "blog:delete",
    "blog:read",
    "vectorize:run",
    "vectorize:delete",
    "rag:query",
    "rag:chat",
    "review:generate",
    "review:read",
    "comment:create",
    "system:config",
    "system:cache:clear",
  ].includes(p);
}

/**
 * 校验角色是否合法
 */
export function isValidRole(r: string): r is Role {
  return ALL_ROLES.includes(r as Role);
}

/**
 * 角色展示信息
 */
export const ROLE_META: Record<
  Role,
  { label: string; description: string; rank: number }
> = {
  admin: {
    label: "管理员",
    description: "全部权限,可管理系统配置",
    rank: 4,
  },
  editor: {
    label: "编辑者",
    description: "可创建/修改博客、向量、综述",
    rank: 3,
  },
  reviewer: {
    label: "审核员",
    description: "可生成综述、评论,不可修改内容",
    rank: 2,
  },
  viewer: {
    label: "访客",
    description: "只读,可用 RAG 问答和查看综述",
    rank: 1,
  },
};
