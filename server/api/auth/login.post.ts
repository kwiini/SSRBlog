/**
 * POST /api/auth/login
 * 校验用户名+密码 → 签发 JWT → 写入 httpOnly cookie
 */
import { login, issueToken } from "../../core/auth";
import { getPermissionsForRole } from "../../core/rbac";

export default defineEventHandler(async (event) => {
  const { username, password } = await readBody(event);

  if (!username || typeof username !== "string") {
    throw createError({ statusCode: 400, message: "请输入用户名" });
  }
  if (!password || typeof password !== "string") {
    throw createError({ statusCode: 400, message: "请输入密码" });
  }

  const payload = await login(username, password);
  if (!payload) {
    throw createError({ statusCode: 401, message: "用户名或密码错误" });
  }

  issueToken(event, payload);

  return {
    success: true,
    role: payload.role,
    username: payload.username,
    permissions: getPermissionsForRole(payload.role),
  };
});
