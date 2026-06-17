/**
 * POST /api/users
 * 创建新用户(仅管理员)
 */
import { createUser, toPublicUser } from "../../core/user-store";
import { isValidRole, ROLE_META } from "../../core/rbac";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { username, password, role } = body || {};

  if (!username || !password || !role) {
    throw createError({
      statusCode: 400,
      message: "username、password、role 必填",
    });
  }
  if (!isValidRole(role)) {
    throw createError({ statusCode: 400, message: "非法角色" });
  }

  try {
    const user = await createUser({ username, password, role });
    return {
      success: true,
      data: {
        ...toPublicUser(user),
        roleMeta: ROLE_META[user.role],
      },
    };
  } catch (err: any) {
    throw createError({ statusCode: 400, message: err.message || "创建失败" });
  }
});
