import { promises as fs } from "fs";
import { parseFrontmatter } from "../../retrieval/frontmatter";
import { resolvePostFilePath } from "../../retrieval/post-path";

/**
 * 读取单篇文章原始内容
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const path = String(query.path || "");
  const fromDraft = query.fromDraft === "1" || query.fromDraft === "true";

  if (!path) {
    throw createError({
      statusCode: 400,
      message: "缺少文章路径",
    });
  }

  // 走共享 helper:剥前缀 + normalizeSlug + 相对路径兜底,杜绝路径穿越
  let filePath: string;
  try {
    ({ filePath } = resolvePostFilePath(path, fromDraft));
  } catch (err: any) {
    throw createError({ statusCode: 400, message: err.message });
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");

    const { frontmatter: meta, body } = parseFrontmatter(content);

    return {
      success: true,
      data: {
        content: body,
        meta,
        isDraft: fromDraft,
      },
    };
  } catch (err: any) {
    throw createError({
      statusCode: 404,
      message: err.message || "文章不存在",
    });
  }
});
