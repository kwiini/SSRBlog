/**
 * GET /api/users
 * 列出所有用户(管理员可见)
 */
import { listUsers, toPublicUser } from "../../core/user-store";
import { ROLE_META } from "../../core/rbac";

export default defineEventHandler(async () => {
  // 中间件已校验 user:list
  const users = await listUsers();
  return {
    success: true,
    data: users.map((u) => ({
      ...toPublicUser(u),
      roleMeta: ROLE_META[u.role],
    })),
  };
});
