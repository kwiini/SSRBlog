/**
 * POST /api/auth/logout
 * 清除 httpOnly cookie
 */
import { clearToken } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  clearToken(event);
  return { success: true };
});
