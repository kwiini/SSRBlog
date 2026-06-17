/**
 * GET /api/auth/me
 * 返回当前登录状态(完整 RBAC 信息,前端用于初始化权限闸门)
 */
import { optionalAuth } from "../../core/auth";
import { getPermissionsForRole, ROLE_META } from "../../core/rbac";

export default defineEventHandler(async (event) => {
  const payload = optionalAuth(event);
  if (!payload) {
    return {
      isLoggedIn: false,
      isAdmin: false,
      role: null,
      username: null,
      permissions: [],
      expiresAt: null,
    };
  }
  const permissions = getPermissionsForRole(payload.role);
  return {
    isLoggedIn: true,
    isAdmin: payload.role === "admin", // 兼容旧字段
    role: payload.role,
    roleMeta: ROLE_META[payload.role],
    username: payload.username,
    userId: payload.uid,
    permissions,
    expiresAt: payload.exp,
  };
});
