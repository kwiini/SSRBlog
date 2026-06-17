/**
 * 相关文章推荐
 *  - GET /api/blog/related?path=xxx&topK=3
 *  - 用第一 chunk 的 embedding 作为文章指纹
 *  - 跟其它文章算 cosine similarity,平均后排序
 *
 * 数据源: server/retrieval/vector-db(SQLite + sqlite-vec)
 */

import { cosineSimilarity } from "../../retrieval/vector";
import { extractTextFromMarkdown } from "../../retrieval/chunker";
import { getAllChunks } from "../../retrieval/vector-db";

interface RelatedPost {
  title: string;
  path: string;
  similarity: number;
  description?: string;
}

/** 把某文章的 chunk 列表的 embedding 求平均,作为该文章的"指纹" */
function calculateArticleAverageEmbedding(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0]?.length ?? 0;
  const sum = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      sum[i] += emb[i] ?? 0;
    }
  }
  return sum.map((v) => v / embeddings.length);
}

async function getRelatedPosts(
  currentPath: string,
  topK: number = 3,
): Promise<RelatedPost[]> {
  const allChunks = getAllChunks();
  if (allChunks.length === 0) return [];

  const currentChunks = allChunks.filter((c) => c.source === currentPath);
  if (currentChunks.length === 0) return [];

  const currentArticleEmbedding = calculateArticleAverageEmbedding(
    currentChunks.map((c) => c.embedding),
  );

  // 按 source 聚合
  const articleGroups = new Map<
    string,
    { title: string; path: string; embs: number[][]; contents: string[] }
  >();
  for (const chunk of allChunks) {
    if (chunk.source === currentPath) continue;
    const g = articleGroups.get(chunk.source);
    if (g) {
      g.embs.push(chunk.embedding);
      g.contents.push(chunk.content);
    } else {
      articleGroups.set(chunk.source, {
        title: chunk.title,
        path: chunk.source,
        embs: [chunk.embedding],
        contents: [chunk.content],
      });
    }
  }

  const results: RelatedPost[] = [];
  for (const article of articleGroups.values()) {
    const articleEmbedding = calculateArticleAverageEmbedding(article.embs);
    const similarity = cosineSimilarity(
      currentArticleEmbedding,
      articleEmbedding,
    );

    const fullContent = article.contents.join("\n");
    const cleanText = extractTextFromMarkdown(fullContent);
    const firstParagraph = cleanText
      .split("\n")
      .find((p) => p.trim().length > 20);
    const description = firstParagraph
      ? firstParagraph.trim().slice(0, 120) + "..."
      : cleanText.slice(0, 120) + "...";

    results.push({
      title: article.title,
      path: article.path,
      similarity,
      description,
    });
  }

  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter((r) => r.similarity > 0.5);
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const currentPath = query.path as string;
  const topK = parseInt(query.topK as string) || 3;

  if (!currentPath) {
    throw createError({ statusCode: 400, message: "缺少 path 参数" });
  }

  try {
    const relatedPosts = await getRelatedPosts(currentPath, topK);
    return { success: true, data: relatedPosts };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || "获取相关文章失败",
    });
  }
});
