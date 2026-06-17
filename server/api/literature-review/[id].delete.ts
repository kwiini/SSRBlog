/**
 * DELETE /api/literature-review/[id]
 * 删除一条归档（级联删除 papers），记录审计日志
 */
import { getDb, logAudit } from "../../core/db";
import { requireAuth } from "../../core/auth";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");
  const { uid: userId } = requireAuth(event);

  if (!id) {
    throw createError({ statusCode: 400, message: "缺少 id" });
  }

  const db = getDb();

  // 先查出归档信息用于审计日志
  const review = db
    .prepare(
      `SELECT user_name, field FROM reviews WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId) as { user_name?: string; field?: string } | undefined;

  if (!review) {
    throw createError({ statusCode: 404, message: "归档不存在或无权限" });
  }

  // 记录审计日志（在删除前）
  logAudit({
    reviewId: id,
    userId,
    userName: review.user_name,
    action: "delete",
    detail: review.field ? `删除归档：${review.field}` : "删除归档",
  });

  db.prepare(`DELETE FROM reviews WHERE id = ? AND user_id = ?`).run(
    id,
    userId,
  );

  return { success: true };
});
