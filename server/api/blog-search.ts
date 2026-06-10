import {
  getEmbeddingCached as getEmbedding,
  cosineSimilarity,
} from "../utils/embedding-cache";
import { extractKeywords } from "../utils/bm25";
import { promises as fs } from "fs";
import { join } from "path";

// · 搜索结果条目
interface SearchResult {
  id: string;
  content: string;
  source: string;
  metadata: {
    title: string;
    path: string;
    index: number;
    total: number;
  };
  similarity: number;
}

// · 向量存储条目
interface VectorStore {
  version: string;
  lastUpdated: string;
  chunks: Array<{
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
  }>;
}

const VECTOR_STORE_PATH = join(process.cwd(), "data", "blog-vectors.json"); // 向量存储文件路径

/**
 * 加载向量数据
 */
async function loadVectors(): Promise<VectorStore | null> {
  try {
    const data = await fs.readFile(VECTOR_STORE_PATH, "utf-8");
    return JSON.parse(data) as VectorStore;
  } catch {
    return null;
  }
}

/**
 * 搜索博客内容
 * @param query 搜索查询
 * @param topK 返回结果数量
 * @returns 搜索结果
 */
async function searchBlogs(
  query: string,
  topK: number = 5,
): Promise<SearchResult[]> {
  const store = await loadVectors();

  if (!store || store.chunks.length === 0) {
    throw new Error("向量数据不存在，请先执行向量化");
  }

  // 获取查询的 embedding
  const queryEmbedding = await getEmbedding(query);

  // 计算相似度
  const results: SearchResult[] = store.chunks.map((chunk) => {
    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    return {
      id: chunk.id,
      content: chunk.content,
      source: chunk.source,
      metadata: chunk.metadata,
      similarity,
    };
  });

  // 按相似度排序并取前 K 个
  const filtered = results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter((r) => r.similarity > 0.3); // 过滤低相似度结果
  
  // 提取关键词用于高亮
  const keywords = extractKeywords(query);
  
  // 添加高亮
  return filtered.map(r => ({
    ...r,
    content: highlightKeywords(r.content, keywords),
  }));
}

/**
 * 高亮关键词
 */
function highlightKeywords(text: string, keywords: string[]): string {
  if (keywords.length === 0) return text;
  
  let highlighted = text;
  for (const keyword of keywords) {
    const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
    highlighted = highlighted.replace(regex, '**$1**');
  }
  return highlighted;
}

/**
 * 转义正则特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 获取相关文章推荐
 * @param currentPath 当前文章路径
 * @param topK 推荐数量
 * @returns 推荐结果
 */
async function getRelatedArticles(
  currentPath: string,
  topK: number = 3,
): Promise<SearchResult[]> {
  const store = await loadVectors();

  if (!store || store.chunks.length === 0) {
    return [];
  }

  // 找到当前文章的所有 chunks
  const currentChunks = store.chunks.filter((c) => c.source === currentPath);

  if (currentChunks.length === 0) {
    return [];
  }

  // 使用第一个 chunk 的 embedding 作为代表
  const currentEmbedding = currentChunks[0]!.embedding;

  // 计算与其他文章的相似度
  const articleScores = new Map<
    string,
    { title: string; path: string; score: number; count: number }
  >();

  for (const chunk of store.chunks) {
    if (chunk.source === currentPath) continue;

    const similarity = cosineSimilarity(currentEmbedding, chunk.embedding);
    const existing = articleScores.get(chunk.source);

    if (existing) {
      existing.score += similarity;
      existing.count += 1;
    } else {
      articleScores.set(chunk.source, {
        title: chunk.metadata.title,
        path: chunk.source,
        score: similarity,
        count: 1,
      });
    }
  }

  // 计算平均相似度并排序
  const sorted = Array.from(articleScores.values())
    .map((a) => ({ ...a, avgScore: a.score / a.count }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, topK);

  return sorted.map((a) => ({
    id: `related_${a.path}`,
    content: "",
    source: a.path,
    metadata: {
      title: a.title,
      path: a.path,
      index: 0,
      total: 1,
    },
    similarity: a.avgScore,
  }));
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { q, topK = "5", related, path } = query;

    // 相关文章推荐模式
    if (related === "true" && path) {
      const results = await getRelatedArticles(
        path as string,
        parseInt(topK as string, 10),
      );
      return {
        success: true,
        results,
        count: results.length,
      };
    }

    // 搜索模式
    if (!q || typeof q !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "请提供搜索关键词 q",
      });
    }

    const results = await searchBlogs(q, parseInt(topK as string, 10));

    return {
      success: true,
      query: q,
      results,
      count: results.length,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "搜索失败",
    });
  }
});
