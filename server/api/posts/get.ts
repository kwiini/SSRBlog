import { promises as fs } from "fs";
import { join } from "path";

const CONTENT_DIR = join(process.cwd(), "content", "articles");
const DRAFT_DIR = join(process.cwd(), "content", "drafts");

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
      statusMessage: "缺少文章路径",
    });
  }

  // 从路径提取 slug
  const slug = path.replace("/articles/", "").replace(/^\//, "").trim();

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "无效的文章路径",
    });
  }

  const dir = fromDraft ? DRAFT_DIR : CONTENT_DIR;
  const filePath = join(dir, `${slug}.md`);

  try {
    const content = await fs.readFile(filePath, "utf-8");

    // 解析 frontmatter
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    let body = content;
    let meta: any = {};

    if (match) {
      body = match[2] ?? "";
      // 简单解析 frontmatter
      const lines = match[1]?.split("\n") ?? [];
      let currentKey = "";
      for (const line of lines) {
        const arrayMatch = line.match(/^\s+-\s+(.+)$/);
        if (arrayMatch && currentKey) {
          if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
          meta[currentKey].push(arrayMatch[1]?.trim() || "");
          continue;
        }
        const [key, ...valueParts] = line.split(":");
        if (key && valueParts.length) {
          currentKey = key.trim();
          meta[currentKey] = valueParts.join(":").trim();
        }
      }
    }

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
      statusMessage: err.message || "文章不存在",
    });
  }
});
