import { join, resolve, relative, isAbsolute } from "path";
import { existsSync } from "fs";

/** content/articles 和 content/drafts 的绝对路径(其他模块都从这里 import,别再各自定义) */
export const POSTS_CONTENT_DIR = join(process.cwd(), "content", "articles");
export const POSTS_DRAFT_DIR = join(process.cwd(), "content", "drafts");

/**
 * 把任何来源的 path 字符串("/articles/foo" / "foo" / "../etc/passwd" / ...)
 * 解析成 content/drafts 或 content/articles 下的合法 .md 路径
 *
 * 防御链(纵深):
 *  1) 剥 URL 前缀 + trim:得到原始 slug
 *  2) normalizeSlug:过滤 ".." "/" "\" NUL 等危险字符
 *     保留 ASCII 字母数字 + 连字符 + CJK 汉字,其余归一为 "-"
 *  3) 拼到 baseDir 后,用 relative() 二次兜底:
 *     即便 normalizeSlug 被新规则绕过,只要解析结果逃出 baseDir 就拒收
 *  4) resolve() 二次规范化,挡掉 "..\..\" 等混合分隔符
 *
 * 返回的 path 可直接 readFile/writeFile/unlink
 */
export function resolvePostFilePath(
  rawPath: string,
  fromDraft: boolean = false,
): { filePath: string; slug: string } {
  // 1) 剥前缀
  const raw = String(rawPath ?? "")
    .replace(/^\/articles\//, "")
    .replace(/^\/+/, "")
    .trim();
  if (!raw) {
    throw new Error("无效的文章路径");
  }
  // 2) normalizeSlug 过滤
  const slug = normalizeSlug(raw);
  if (!slug) {
    throw new Error("无效的文章路径");
  }
  // 3) 拼路径 + 兜底
  const baseDir = resolve(fromDraft ? POSTS_DRAFT_DIR : POSTS_CONTENT_DIR);
  const filePath = join(baseDir, `${slug}.md`);
  const rel = relative(baseDir, filePath);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("非法的文章路径");
  }
  return { filePath, slug };
}

export function postFileExists(rawPath: string, fromDraft = false): boolean {
  try {
    const { filePath } = resolvePostFilePath(rawPath, fromDraft);
    return existsSync(filePath);
  } catch {
    return false;
  }
}

function normalizeSlug(slug: string): string {
  return (
    slug
      .trim()
      .toLowerCase()
      // 保留 ASCII 字母数字 + 连字符 + CJK 汉字;其他字符归一为 "-"
      .replace(/[^a-z0-9\p{Script=Han}-]/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
