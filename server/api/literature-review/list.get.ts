/**
 * GET /api/literature-review/list
 * 列出当前用户的所有综述归档（按创建时间倒序）
 */
import { getDb } from "../../core/db";
import { requireAuth } from "../../core/auth";

export default defineEventHandler((event) => {
  const { uid: userId } = requireAuth(event);

  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        r.id,
        r.user_id,
        r.user_name,
        r.field,
        r.reporter,
        r.review_date,
        r.created_at,
        r.updated_at,
        (SELECT COUNT(*) FROM review_papers WHERE review_id = r.id) AS paper_count
      FROM reviews r
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
      `
    )
    .all(userId);

  return { success: true, data: rows };
});
