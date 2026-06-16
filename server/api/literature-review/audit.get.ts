/**
 * GET /api/literature-review/audit?reviewId=xxx&limit=50
 * 查询审计日志
 * - 当前用户：只看自己的操作记录
 * - reviewId 可选：只看某条综述的操作记录
 * - limit 可选：默认 50
 */
import { getDb } from "../../core/db";
import { requireAuth } from "../../core/auth";

export default defineEventHandler((event) => {
  const { uid: userId } = requireAuth(event);
  const query = getQuery(event);
  const reviewId = query.reviewId as string | undefined;
  const limit = Math.min(Number(query.limit) || 50, 200);

  const db = getDb();

  let rows: any[];
  if (reviewId) {
    rows = db
      .prepare(
        `
        SELECT id, review_id, user_id, user_name, action, detail, created_at
        FROM audit_logs
        WHERE user_id = ? AND review_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        `
      )
      .all(userId, reviewId, limit);
  } else {
    rows = db
      .prepare(
        `
        SELECT id, review_id, user_id, user_name, action, detail, created_at
        FROM audit_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        `
      )
      .all(userId, limit);
  }

  return { success: true, data: rows };
});
