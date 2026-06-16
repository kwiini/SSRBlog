/**
 * PATCH /api/users/[id]
 * 更新用户(改角色 / 改密码 / 启用禁用)
 * - 普通字段可单独 patch
 * - 改 password 时要传新密码明文(内部 PBKDF2 哈希后再存)
 */
import { updateUser, toPublicUser } from "../../core/user-store";
import { isValidRole, ROLE_META } from "../../core/rbac";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "缺少用户 ID" });
  }
  const body = await readBody(event);
  const patch: any = {};

  if (body.role !== undefined) {
    if (!isValidRole(body.role)) {
      throw createError({ statusCode: 400, message: "非法角色" });
    }
    patch.role = body.role;
  }
  if (body.password !== undefined) {
    if (typeof body.password !== "string" || body.password.length < 6) {
      throw createError({ statusCode: 400, message: "密码长度至少 6 位" });
    }
    patch.password = body.password;
  }
  if (body.disabled !== undefined) {
    patch.disabled = !!body.disabled;
  }

  try {
    const user = await updateUser(id, patch);
    return {
      success: true,
      data: {
        ...toPublicUser(user),
        roleMeta: ROLE_META[user.role],
      },
    };
  } catch (err: any) {
    throw createError({ statusCode: 400, message: err.message || "更新失败" });
  }
});
