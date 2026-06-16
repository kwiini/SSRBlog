/**
 * DELETE /api/users/[id]
 * 删除用户(至少保留一个 admin 保护)
 */
import { deleteUser } from "../../core/user-store";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "缺少用户 ID" });
  }
  try {
    await deleteUser(id);
    return { success: true };
  } catch (err: any) {
    throw createError({ statusCode: 400, message: err.message || "删除失败" });
  }
});
