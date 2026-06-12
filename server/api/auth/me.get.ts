/**
 * GET /api/auth/me
 * 返回当前登录状态（前端用于初始化 isAdmin）
 */
import { optionalAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const payload = optionalAuth(event);
  return {
    isAdmin: payload?.sub === "admin",
    expiresAt: payload?.exp || null,
  };
});
