/**
 * 博客向量化 API
 *  - GET    拿统计
 *  - POST   向量化全部 / 单篇增量
 *  - DELETE 清空
 *
 * 存储后端: server/retrieval/vector-db.ts(SQLite + sqlite-vec)
 * 启动时自动跑一次性迁移:从老的 data/blog-vectors.json 读出来,写进 vec0,JSON 改名 .bak
 */

import {
  splitMarkdownToChunks,
} from "../../retrieval/chunker";
import { getEmbeddingsCached as getEmbeddings } from "../../retrieval/vector";
import {
  upsertChunks,
  deleteBySource,
  countChunks,
  clearAllChunks,
  clearAllChunksCache,
  getAllChunks,
  type ChunkRecord,
} from "../../retrieval/vector-db";
import { migrateFromJson } from "../../retrieval/migrate-vectors";
import { parseFrontmatter } from "../../retrieval/frontmatter";
import { promises as fs } from "fs";
import { join } from "path";
import { resolvePostFilePath } from "~~/server/retrieval/post-path";

interface VectorizedChunk {
  id: string;
  content: string;
  embedding: number[];
  source: string;
  metadata: {
    title: string;
    path: string;
    index: number;
    total: number;
  };
}

const CONTENT_DIR = join(process.cwd(), "content");

// · 一次性迁移(模块加载时执行,确保 JSON 数据有就搬到 db)
let _migrated = false;
async function ensureMigrated() {
  if (_migrated) return;
  _migrated = true;
  try {
    const r = await migrateFromJson();
    if (r.migrated > 0) {
      console.log(`[vectorize] 自动迁移 ${r.migrated} 条 chunks from JSON → ${r.backupPath}`);
    }
  } catch (e) {
    console.warn("[vectorize] 迁移失败,继续运行:", e);
  }
}

async function getAllBlogPosts() {
  const posts: any[] = [];
  try {
    await fs.access(CONTENT_DIR);
    await readMarkdownFiles(CONTENT_DIR, posts);
  } catch {
    console.warn("Content directory not found");
  }
  return posts;
}

async function readMarkdownFiles(dir: string, posts: any[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await readMarkdownFiles(fullPath, posts);
    } else if (entry.name.endsWith(".md")) {
      const content = await fs.readFile(fullPath, "utf-8");
      const relativePath = fullPath
        .replace(process.cwd(), "")
        .replace(/\\/g, "/")
        .replace("/content", "")
        .replace(".md", "");

      const { frontmatter, body } = parseMarkdown(content);
      const h1Match = content.match(/^#\s+(.+)$/m);
      const contentTitle = h1Match?.[1]?.trim();
      const fileNameTitle = entry.name
        .replace(".md", "")
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      posts.push({
        path: relativePath,
        title: frontmatter.title || contentTitle || fileNameTitle,
        description: frontmatter.description || "",
        meta: { date: frontmatter.date },
        body: { value: body },
      });
    }
  }
}

function parseMarkdown(content: string) {
  return parseFrontmatter(content);
}

/** 转 ChunkRecord(给 vector-db) */
function toChunkRecord(c: VectorizedChunk): ChunkRecord {
  return {
    id: c.id,
    content: c.content,
    source: c.source,
    title: c.metadata.title,
    path: c.metadata.path,
    chunkIndex: c.metadata.index,
    chunkTotal: c.metadata.total,
    embedding: c.embedding,
  };
}

async function vectorizeAllBlogs(): Promise<number> {
  const posts = await getAllBlogPosts();
  if (!posts.length) throw new Error("没有找到博客文章");

  let total = 0;
  for (const post of posts) {
    console.log(`Processing: ${post.title}`);
    const markdown = post.body?.value || "";
    if (!markdown) {
      console.warn(`No content for: ${post.title}`);
      continue;
    }
    const chunks = splitMarkdownToChunks(markdown, post.path, {
      title: post.title,
      path: post.path,
    });
    if (chunks.length === 0) continue;

    const texts = chunks.map((c) => c.content);
    const embeddings = await getEmbeddings(texts);

    const records: VectorizedChunk[] = chunks.map((c, i) => ({
      id: c.id,
      content: c.content,
      embedding: embeddings[i]!,
      source: c.source,
      metadata: c.metadata,
    }));

    // 先清掉这篇文章的旧 chunks,再 upsert 新的
    deleteBySource(post.path);
    upsertChunks(records.map(toChunkRecord));
    total += records.length;
    console.log(`  ✓ ${chunks.length} chunks`);
  }
  return total;
}

async function vectorizeSinglePost(postPath: string): Promise<number> {
  // 走共享 helper:剥前缀 + normalizeSlug + 相对路径兜底,杜绝路径穿越
  // postPath 来源是 body.path(用户输入),必须 sanitize
  const { filePath } = resolvePostFilePath(postPath, false);
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    throw new Error(`文章不存在: ${postPath}`);
  }

  const { frontmatter, body } = parseMarkdown(content);
  // frontmatter.title 在 schema 里是 string | string[](为兼容 tags 数组)
  // chunker 契约只收 string,这里归一化:数组用 ", " 拼接,空值走 fallback
  const titleFallback = postPath.split("/").pop() || "Untitled";
  const rawTitle = frontmatter.title || titleFallback;
  const title = Array.isArray(rawTitle)
    ? rawTitle.filter(Boolean).join(", ") || titleFallback
    : rawTitle;
  const markdown = body || "";
  if (!markdown.trim()) {
    console.warn(`No content for: ${title}`);
    return 0;
  }

  const chunks = splitMarkdownToChunks(markdown, postPath, { title, path: postPath });
  if (chunks.length === 0) return 0;

  const texts = chunks.map(c => c.content);
  const embeddings = await getEmbeddings(texts);

  const records: ChunkRecord[] = chunks.map((c, i) => ({
    id: c.id,
    content: c.content,
    source: c.source,
    title: c.metadata.title,
    path: c.metadata.path,
    chunkIndex: c.metadata.index,
    chunkTotal: c.metadata.total,
    embedding: embeddings[i]!,
  }));

  // 增量:删旧 + 写新
  deleteBySource(postPath);
  upsertChunks(records);
  return records.length;
}

function getStats() {
  const total = countChunks();
  if (total === 0) {
    return { exists: false, chunkCount: 0, articleCount: 0, articles: [] as Array<{ path: string; chunks: number }> };
  }
  const chunks = getAllChunks();
  const articleMap = new Map<string, number>();
  for (const c of chunks) {
    articleMap.set(c.source, (articleMap.get(c.source) ?? 0) + 1);
  }
  return {
    exists: true,
    chunkCount: total,
    articleCount: articleMap.size,
    articles: Array.from(articleMap.entries()).map(([path, chunks]) => ({ path, chunks })),
  };
}

export default defineEventHandler(async (event) => {
  await ensureMigrated();
  const method = getMethod(event);

  if (method === "GET") {
    try {
      const stats = getStats();
      return { success: true, ...stats };
    } catch (error: any) {
      throw createError({ statusCode: 500, message: error.message || "获取统计失败" });
    }
  }

  if (method === "POST") {
    try {
      const body = await readBody(event);
      const { force = false, path } = body;

      console.log("Starting blog vectorization...");
      const startTime = Date.now();

      let count: number;
      if (path) {
        console.log(`Incremental vectorization for: ${path}`);
        count = await vectorizeSinglePost(path);
      } else {
        if (!force && countChunks() > 0) {
          return {
            success: true,
            message: "向量已存在,使用 force: true 重新生成",
            stats: getStats(),
          };
        }
        if (force) clearAllChunks();
        count = await vectorizeAllBlogs();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Vectorization completed in ${duration}s`);

      return {
        success: true,
        message: `成功向量化 ${count} 个 chunks`,
        stats: {
          processedCount: count,
          ...getStats(),
          duration: `${duration}s`,
        },
      };
    } catch (error: any) {
      throw createError({ statusCode: 500, message: error.message || "向量化失败" });
    }
  }

  if (method === "DELETE") {
    try {
      const n = clearAllChunks();
      return { success: true, message: `已清空 ${n} 条`, cleared: n };
    } catch (error: any) {
      throw createError({ statusCode: 500, message: error.message || "清空失败" });
    }
  }

  throw createError({ statusCode: 405, message: "Method not allowed" });
});
