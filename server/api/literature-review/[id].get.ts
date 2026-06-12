/**
 * GET /api/literature-review/[id]?userId=xxx
 * 读取单条综述详情（含 papers 全文），仅限本人
 */
import { getDb } from "../../utils/db";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");
  const userId = getQuery(event).userId as string | undefined;

  if (!id || !userId) {
    throw createError({ statusCode: 400, statusMessage: "参数不完整" });
  }

  const db = getDb();
  const review = db
    .prepare(
      `SELECT * FROM reviews WHERE id = ? AND user_id = ?`
    )
    .get(id, userId) as Record<string, any> | undefined;

  if (!review) {
    throw createError({ statusCode: 404, statusMessage: "归档不存在或无权限" });
  }

  const papers = db
    .prepare(
      `
      SELECT id, name, size, is_pdf, is_docx, is_doc, content, html_content, sort_order
      FROM review_papers
      WHERE review_id = ?
      ORDER BY sort_order ASC
      `
    )
    .all(id) as any[];

  return {
    success: true,
    data: {
      ...review,
      papers: papers.map((p) => ({
        id: p.id,
        name: p.name,
        size: p.size,
        isPdf: !!p.is_pdf,
        isDocx: !!p.is_docx,
        isDoc: !!p.is_doc,
        content: p.content || "",
        htmlContent: p.html_content || "",
      })),
    },
  };
});
