/**
 * GET /api/literature-review/list?userId=xxx
 * 列出某用户的所有综述归档（按创建时间倒序）
 */
import { getDb } from "../../utils/db";

export default defineEventHandler((event) => {
  const userId = getQuery(event).userId as string | undefined;
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "缺少 userId" });
  }

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
