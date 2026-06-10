import { promises as fs } from "fs";
import { join } from "path";

// · 文章数据条目
interface PostData {
  title: string;
  slug: string;
  content: string;
  description?: string;
  date?: string;
  tags?: string[];
  publish?: boolean;
}

const CONTENT_DIR = join(process.cwd(), "content", "articles"); // 文章目录
const DRAFT_DIR = join(process.cwd(), "content", "drafts"); // 草稿目录

/**
 * 确保内容目录存在
 */
async function ensureDir(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * 解析文章文件路径（草稿或已发布）
 */
function resolveFilePath(slug: string, publish: boolean): string {
  const dir = publish ? CONTENT_DIR : DRAFT_DIR;
  return join(dir, `${slug}.md`);
}

/**
 * 检查文件存在
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证 slug
 */
function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 生成文章文件内容
 */
function generateMarkdown(data: PostData): string {
  const frontmatter = {
    title: data.title,
    description: data.description || "",
    date: data.date || new Date().toISOString().split("T")[0],
    tags: data.tags || [],
  };

  const frontmatterYaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
      }
      return `${key}: ${value}`;
    })
    .join("\n");

  return `---\n${frontmatterYaml}\n---\n\n${data.content}`;
}

/**
 * 保存文章（草稿或发布）
 * publish=false: 写入 drafts 目录
 * publish=true:  从 drafts 移动到 articles（发布）；或在 articles 中更新
 */
async function savePost(data: PostData, publish: boolean): Promise<{ path: string; slug: string }> {
  await ensureDir(CONTENT_DIR);
  await ensureDir(DRAFT_DIR);

  const slug = normalizeSlug(data.slug || "");
  if (!slug) throw new Error("无效的文章路径");

  const draftPath = join(DRAFT_DIR, `${slug}.md`);
  const articlePath = join(CONTENT_DIR, `${slug}.md`);

  const targetPath = publish ? articlePath : draftPath;

  if (publish) {
    // 发布：草稿存在则删除，文章存在则覆盖
    if (await fileExists(draftPath)) {
      await fs.unlink(draftPath);
    }
  } else {
    // 保存草稿：避免覆盖已发布的同名文章
    if (await fileExists(articlePath)) {
      throw new Error("该路径已存在已发布文章");
    }
  }

  const markdown = generateMarkdown(data);
  await fs.writeFile(targetPath, markdown, "utf-8");

  return {
    path: `/articles/${slug}`,
    slug,
  };
}

/**
 * 删除文章
 */
async function deletePost(path: string, fromDraft: boolean = false): Promise<void> {
  const slug = path.replace("/articles/", "").replace(/^\//, "").trim();
  if (!slug) throw new Error("无效的文章路径");

  const dir = fromDraft ? DRAFT_DIR : CONTENT_DIR;
  const filePath = join(dir, `${slug}.md`);

  if (!(await fileExists(filePath))) {
    throw new Error("文章不存在");
  }
  await fs.unlink(filePath);
}

/**
 * 列出草稿
 */
async function listDrafts(): Promise<Array<{ slug: string; path: string }>> {
  await ensureDir(DRAFT_DIR);
  const files = await fs.readdir(DRAFT_DIR);
  return files
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      slug: f.replace(/\.md$/, ""),
      path: `/articles/${f.replace(/\.md$/, "")}`,
    }));
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const query = getQuery(event);

  // GET - 列出草稿
  if (method === "GET" && query.listDrafts === "1") {
    const drafts = await listDrafts();
    return { success: true, data: drafts };
  }

  // POST - 保存草稿
  if (method === "POST") {
    try {
      const body = (await readBody(event)) as PostData;
      if (!body.title?.trim()) {
        throw createError({ statusCode: 400, statusMessage: "文章标题不能为空" });
      }
      if (!body.content?.trim()) {
        throw createError({ statusCode: 400, statusMessage: "文章内容不能为空" });
      }

      const result = await savePost(body, false);
      return { success: true, message: "草稿保存成功", data: result };
    } catch (error: any) {
      throw createError({ statusCode: 500, statusMessage: error.message || "保存草稿失败" });
    }
  }

  // PUT - 更新或发布
  if (method === "PUT") {
    try {
      const body = (await readBody(event)) as PostData;
      if (!body.title?.trim()) {
        throw createError({ statusCode: 400, statusMessage: "文章标题不能为空" });
      }
      if (!body.content?.trim()) {
        throw createError({ statusCode: 400, statusMessage: "文章内容不能为空" });
      }

      const publish = body.publish === true;
      const result = await savePost(body, publish);
      return {
        success: true,
        message: publish ? "文章发布成功" : "草稿更新成功",
        data: result,
      };
    } catch (error: any) {
      throw createError({ statusCode: 500, statusMessage: error.message || "操作失败" });
    }
  }

  // DELETE - 删除文章/草稿
  if (method === "DELETE") {
    try {
      const body = (await readBody(event)) as { path: string; fromDraft?: boolean };
      if (!body.path) {
        throw createError({ statusCode: 400, statusMessage: "缺少文章路径" });
      }
      await deletePost(body.path, body.fromDraft);
      return { success: true, message: "删除成功" };
    } catch (error: any) {
      throw createError({ statusCode: 500, statusMessage: error.message || "删除失败" });
    }
  }

  throw createError({ statusCode: 405, statusMessage: "Method not allowed" });
});
