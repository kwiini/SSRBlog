/**
 * POST /api/literature-review/save
 * 持久化一篇综述（含全部 papers 的全文），用于央企办公室可追溯归档
 * Body: { userId, userName?, reviewId?, field, background, innovation, trend, thoughts, reporter, date, papers[] }
 */
import { generateId, getDb, logAudit } from "../../utils/db";

interface SavePaper {
  name: string;
  size?: number;
  content?: string;
  htmlContent?: string;
  isPdf?: boolean;
  isDocx?: boolean;
  isDoc?: boolean;
}

interface SaveBody {
  userId: string;
  userName?: string;
  reviewId?: string;
  field?: string;
  background?: string;
  innovation?: string;
  trend?: string;
  thoughts?: string;
  reporter?: string;
  date?: string;
  papers: SavePaper[];
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<SaveBody>(event);

    if (!body?.userId) {
      throw createError({ statusCode: 400, statusMessage: "缺少 userId" });
    }
    if (!Array.isArray(body.papers) || body.papers.length === 0) {
      throw createError({ statusCode: 400, statusMessage: "papers 不能为空" });
    }

    const db = getDb();
    const now = Date.now();
    const reviewId = body.reviewId || generateId();

    const upsertReview = db.prepare(`
      INSERT INTO reviews (
        id, user_id, user_name, field, background, innovation, trend, thoughts, reporter, review_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_name = excluded.user_name,
        field = excluded.field,
        background = excluded.background,
        innovation = excluded.innovation,
        trend = excluded.trend,
        thoughts = excluded.thoughts,
        reporter = excluded.reporter,
        review_date = excluded.review_date,
        updated_at = excluded.updated_at
    `);

    const deletePapers = db.prepare(
      `DELETE FROM review_papers WHERE review_id = ?`
    );
    const insertPaper = db.prepare(`
      INSERT INTO review_papers (
        id, review_id, name, size, is_pdf, is_docx, is_doc, content, html_content, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      // 若指定了 reviewId，但不属于该 user，禁止覆写
      const isUpdate = !!body.reviewId;
      if (isUpdate) {
        const existing = db
          .prepare(`SELECT user_id FROM reviews WHERE id = ?`)
          .get(body.reviewId) as { user_id: string } | undefined;
        if (existing && existing.user_id !== body.userId) {
          throw new Error("无权修改他人归档");
        }
      }

      upsertReview.run(
        reviewId,
        body.userId,
        body.userName || null,
        body.field || null,
        body.background || null,
        body.innovation || null,
        body.trend || null,
        body.thoughts || null,
        body.reporter || null,
        body.date || null,
        now,
        now
      );

      deletePapers.run(reviewId);
      body.papers.forEach((p, idx) => {
        insertPaper.run(
          generateId(),
          reviewId,
          p.name,
          p.size || 0,
          p.isPdf ? 1 : 0,
          p.isDocx ? 1 : 0,
          p.isDoc ? 1 : 0,
          p.content || null,
          p.htmlContent || null,
          idx
        );
      });

      // 审计日志
      logAudit({
        reviewId,
        userId: body.userId,
        userName: body.userName,
        action: isUpdate ? "update" : "create",
        detail: `${body.papers.length} 篇文献${isUpdate ? "，更新归档" : ""}`,
      });
    });

    tx();

    return { success: true, id: reviewId };
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: err.message || "保存失败",
    });
  }
});
