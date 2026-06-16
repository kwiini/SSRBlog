import { promises as fs } from "fs";
import { join } from "path";
import {
  resolvePostFilePath,
  POSTS_CONTENT_DIR as CONTENT_DIR,
  POSTS_DRAFT_DIR as DRAFT_DIR,
} from "../../retrieval/post-path";

interface PostData {
  title: string;
  slug: string;
  content: string;
  description?: string;
  date?: string;
  tags?: string[];
  publish?: boolean;
  /**
   * PUT 时必传,用于定位要更新的旧文件(支持 slug 重命名:id=旧 slug, slug=新 slug)
   * POST 时忽略
   */
  id?: string;
}

type SaveMode = "create" | "update";

async function ensureDir(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    // 保留 ASCII 字母数字 + 连字符 + CJK 汉字;其他字符归一为 "-"
    .replace(/[^a-z0-9\p{Script=Han}-]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 把任意 JS 值序列化为安全的 YAML 标量/数组
 *  - 字符串一律双引号包裹,转义 " \ \n \r \t
 *  - 数组每项独立转义
 *  - 数字/布尔/null 直出
 *  - 日期统一双引号包裹,避免 YAML 自动转成 Date 对象
 */
function yamlScalar(v: unknown, depth = 0): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const itemDepth = depth + 1;
    return v
      .map((x) => {
        const itemYaml = yamlScalar(x, itemDepth);
        // 数组项是 block scalar 时,需要把指示符接到 dash 后,
        // 并把内容行重新缩进到 (itemDepth+1)*2 空格
        // 这样下一项的 dash(在 itemDepth*2 空格)缩进 < 内容缩进,能正确结束块
        if (
          itemYaml.startsWith("|") ||
          itemYaml.startsWith(">")
        ) {
          const dashIndent = " ".repeat(itemDepth * 2);
          const contentIndent = " ".repeat((itemDepth + 1) * 2);
          const lines = itemYaml.split("\n");
          const head = `${dashIndent}- ${lines[0]}`;
          const body = lines
            .slice(1)
            .map((l) => contentIndent + l)
            .join("\n");
          return body ? `${head}\n${body}` : head;
        }
        return `${" ".repeat(itemDepth * 2)}- ${itemYaml}`;
      })
      .join("\n");
  }
  const s = String(v);
  // 多行字符串:literal block scalar,按尾换行数选 chomping 指示符
  // 内容缩进 = (depth+1)*2,确保 > 调用方缩进,后续同/低缩进的行能正确结束块
  //   depth=0 → 2 空格(top-level)
  //   depth=1 → 4 空格(数组项内,dash 缩进 2 空格,内容 4 空格,下一项 dash 缩进 2 < 4 结束块)
  if (s.includes("\n")) {
    const trailing = s.match(/\n*$/)?.[0].length ?? 0;
    const indicator = trailing === 0 ? "|-" : trailing === 1 ? "|" : "|+";
    const contentIndent = " ".repeat((depth + 1) * 2);
    return (
      indicator +
      "\n" +
      s.split("\n").map((line) => contentIndent + line).join("\n")
    );
  }
  // 单行:双引号流式 + 完整转义
  return (
    '"' +
    s
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      // 控制字符(除已单独处理的 \n \r \t):用 \x## 十六进制转义
      // 覆盖 NUL(0x00)、BEL(0x07)、BS(0x08)、VT(0x0B)、FF(0x0C)、
      // SO..US(0x0E-0x1F)、DEL(0x7F)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, (c) =>
        "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0"),
      )
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n") +
    '"'
  );
}

function generateMarkdown(data: PostData): string {
  const frontmatter = {
    title: data.title,
    description: data.description || "",
    date: data.date || new Date().toISOString().split("T")[0],
    tags: data.tags || [],
  };

  const frontmatterYaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      // 数组值:key 独占一行,items 缩进 2 空格
      // 避免 `tags:   - "a"` 这种内联写法被部分解析器误读
      if (Array.isArray(value)) {
        if (value.length === 0) return `${key}: []`;
        return `${key}:\n${value
          .map((x) => `  - ${yamlScalar(x)}`)
          .join("\n")}`;
      }
      return `${key}: ${yamlScalar(value)}`;
    })
    .join("\n");

  // 防止正文以 "---" 开头被解析器误判为第二个 frontmatter 块
  const body = data.content?.startsWith("---")
    ? `\n${data.content}`
    : data.content;

  return `---\n${frontmatterYaml}\n---\n\n${body}`;
}

async function savePost(
  data: PostData,
  publish: boolean,
  mode: SaveMode,
): Promise<{ path: string; slug: string }> {
  await ensureDir(CONTENT_DIR);
  await ensureDir(DRAFT_DIR);

  const slug = normalizeSlug(data.slug || "");
  if (!slug) throw new Error("无效的文章路径");

  const newDraftPath = join(DRAFT_DIR, `${slug}.md`);
  const newArticlePath = join(CONTENT_DIR, `${slug}.md`);
  const newTargetPath = publish ? newArticlePath : newDraftPath;

  if (mode === "create") {
    // 唯一性:目标位置不能与任何同名文件冲突
    if (await fileExists(newTargetPath)) {
      throw new Error(
        publish
          ? "该路径已存在已发布文章"
          : "草稿已存在,请改用 PUT 更新或更换路径",
      );
    }
    // 发布时若残留同名草稿,自动清理(草稿作废)
    if (publish && (await fileExists(newDraftPath))) {
      await fs.unlink(newDraftPath);
    }
  } else {
    // update:必传 id(旧 slug)用以定位原文件
    const oldSlug = normalizeSlug(data.id || "");
    if (!oldSlug) {
      throw createError({
        statusCode: 400,
        message: "更新操作必须提供 id(旧 slug)",
      });
    }
    const oldDraftPath = join(DRAFT_DIR, `${oldSlug}.md`);
    const oldArticlePath = join(CONTENT_DIR, `${oldSlug}.md`);
    const oldPath = (await fileExists(oldDraftPath))
      ? oldDraftPath
      : (await fileExists(oldArticlePath))
        ? oldArticlePath
        : null;
    if (!oldPath) {
      throw createError({
        statusCode: 404,
        message: `找不到要更新的文章: ${oldSlug}`,
      });
    }
    // 旧文件删掉(支持 slug 重命名:旧 id → 新 slug)
    await fs.unlink(oldPath);
  }

  const markdown = generateMarkdown(data);
  await fs.writeFile(newTargetPath, markdown, "utf-8");

  return {
    path: `/articles/${slug}`,
    slug,
  };
}

async function deletePost(path: string, fromDraft: boolean = false): Promise<void> {
  // 走共享 helper:剥前缀 + normalizeSlug + 相对路径兜底,杜绝路径穿越
  const { filePath } = resolvePostFilePath(path, fromDraft);
  if (!(await fileExists(filePath))) {
    throw new Error("文章不存在");
  }
  await fs.unlink(filePath);
}

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

/**
 * /api/blog/posts
 *  - GET ?listDrafts=1     草稿列表
 *  - POST                  保存草稿
 *  - PUT                   更新 / 发布
 *  - DELETE                删除文章
 */
export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const query = getQuery(event);

  if (method === "GET" && query.listDrafts === "1") {
    const drafts = await listDrafts();
    return { success: true, data: drafts };
  }

  if (method === "POST") {
    try {
      const body = (await readBody(event)) as PostData;
      if (!body.title?.trim()) {
        throw createError({ statusCode: 400, message: "文章标题不能为空" });
      }
      if (!body.content?.trim()) {
        throw createError({ statusCode: 400, message: "文章内容不能为空" });
      }

      const result = await savePost(body, false, "create");
      return { success: true, message: "草稿保存成功", data: result };
    } catch (error: any) {
      throw createError({ statusCode: 500, message: error.message || "保存草稿失败" });
    }
  }

  if (method === "PUT") {
    try {
      const body = (await readBody(event)) as PostData;
      if (!body.title?.trim()) {
        throw createError({ statusCode: 400, message: "文章标题不能为空" });
      }
      if (!body.content?.trim()) {
        throw createError({ statusCode: 400, message: "文章内容不能为空" });
      }

      const publish = body.publish === true;
      const result = await savePost(body, publish, "update");
      return {
        success: true,
        message: publish ? "文章发布成功" : "草稿更新成功",
        data: result,
      };
    } catch (error: any) {
      throw createError({ statusCode: 500, message: error.message || "操作失败" });
    }
  }

  if (method === "DELETE") {
    try {
      const body = (await readBody(event)) as { path: string; fromDraft?: boolean };
      if (!body.path) {
        throw createError({ statusCode: 400, message: "缺少文章路径" });
      }
      await deletePost(body.path, body.fromDraft);
      return { success: true, message: "删除成功" };
    } catch (error: any) {
      throw createError({ statusCode: 500, message: error.message || "删除失败" });
    }
  }

  throw createError({ statusCode: 405, message: "Method not allowed" });
});
