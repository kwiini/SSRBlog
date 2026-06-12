/**
 * POST /api/auth/login
 * 校验密码 → 签发 JWT → 写入 httpOnly cookie
 */
import { verifyPassword, issueToken } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const { password } = await readBody(event);

  if (!password || typeof password !== "string") {
    throw createError({ statusCode: 400, statusMessage: "请输入密码" });
  }

  if (!verifyPassword(password)) {
    throw createError({ statusCode: 401, statusMessage: "密码错误" });
  }

  issueToken(event);

  return { success: true };
});
