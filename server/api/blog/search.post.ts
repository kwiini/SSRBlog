/**
 * 博客搜索 + 相关文章
 *  - ?q=xxx        KNN 向量检索
 *  - ?related=true&path=xxx 相关文章
 *
 * 向量检索走 server/retrieval/vector-db.ts 的 KNN(MATCH 算子),
 * BM25 那部分在 hybrid.ts 里组合。
 */

import {
  getEmbeddingCached as getEmbedding,
  cosineSimilarity,
} from "../../retrieval/vector";
import { extractKeywords } from "../../retrieval/bm25";
import {
  searchByVector,
  getAllChunks,
  type SearchHit,
} from "../../retrieval/vector-db";

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

function hitToResult(h: SearchHit): SearchResult {
  return {
    id: h.id,
    content: h.content,
    source: h.source,
    metadata: {
      title: h.title,
      path: h.path,
      index: h.chunkIndex,
      total: h.chunkTotal,
    },
    similarity: h.similarity,
  };
}

async function searchBlogs(
  query: string,
  topK: number = 5,
): Promise<SearchResult[]> {
  const queryEmbedding = await getEmbedding(query);
  const hits = searchByVector(queryEmbedding, { topK, threshold: 0.3 });
  const keywords = extractKeywords(query);
  return hits.map(h => ({
    ...hitToResult(h),
    content: highlightKeywords(h.content, keywords),
  }));
}

function highlightKeywords(text: string, keywords: string[]): string {
  if (keywords.length === 0) return text;
  let highlighted = text;
  for (const keyword of keywords) {
    const regex = new RegExp(`(${escapeRegex(keyword)})`, "gi");
    highlighted = highlighted.replace(regex, "**$1**");
  }
  return highlighted;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getRelatedArticles(
  currentPath: string,
  topK: number = 3,
): Promise<SearchResult[]> {
  const allChunks = getAllChunks();
  if (allChunks.length === 0) return [];

  const currentChunks = allChunks.filter(c => c.source === currentPath);
  if (currentChunks.length === 0) return [];

  // 用首条 chunk 的 embedding 作为"文章指纹"(历史实现就是这个口径,保留兼容)
  const currentEmbedding = currentChunks[0]!.embedding;

  const articleScores = new Map<
    string,
    { title: string; path: string; score: number; count: number }
  >();

  for (const chunk of allChunks) {
    if (chunk.source === currentPath) continue;
    const sim = cosineSimilarity(currentEmbedding, chunk.embedding);
    const existing = articleScores.get(chunk.source);
    if (existing) {
      existing.score += sim;
      existing.count += 1;
    } else {
      articleScores.set(chunk.source, {
        title: chunk.title,
        path: chunk.source,
        score: sim,
        count: 1,
      });
    }
  }

  const sorted = Array.from(articleScores.values())
    .map(a => ({ ...a, avgScore: a.score / a.count }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, topK);

  return sorted.map(a => ({
    id: `related_${a.path}`,
    content: "",
    source: a.path,
    metadata: { title: a.title, path: a.path, index: 0, total: 1 },
    similarity: a.avgScore,
  }));
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { q, topK = "5", related, path } = query;

    if (related === "true" && path) {
      const results = await getRelatedArticles(path as string, parseInt(topK as string, 10));
      return { success: true, results, count: results.length };
    }

    if (!q || typeof q !== "string") {
      throw createError({ statusCode: 400, message: "请提供搜索关键词 q" });
    }

    const results = await searchBlogs(q, parseInt(topK as string, 10));
    return { success: true, query: q, results, count: results.length };
  } catch (error: any) {
    throw createError({ statusCode: 500, message: error.message || "搜索失败" });
  }
});
