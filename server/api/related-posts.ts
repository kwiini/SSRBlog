import { cosineSimilarity } from "../utils/embedding-cache";
import { promises as fs } from "fs";
import { join } from "path";

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

interface RelatedPost {
  title: string;
  path: string;
  similarity: number;
  description?: string;
}

const VECTOR_STORE_PATH = join(process.cwd(), "data", "blog-vectors.json");

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
 * 计算文章的平均向量（基于该文章的所有 chunks）
 */
function calculateArticleAverageEmbedding(
  chunks: VectorStore["chunks"],
): number[] {
  if (chunks.length === 0) return [];

  const embeddingLength = chunks[0]?.embedding.length;
  const sum = new Array(embeddingLength).fill(0);

  for (const chunk of chunks) {
    for (let i = 0; i < (embeddingLength ?? 0); i++) {
      sum[i] += chunk.embedding[i] ?? 0;
    }
  }

  return sum.map((v) => v / chunks.length);
}

/**
 * 获取相关文章
 * @param currentPath 当前文章路径
 * @param topK 返回结果数量
 * @returns 相关文章列表
 */
async function getRelatedPosts(
  currentPath: string,
  topK: number = 3,
): Promise<RelatedPost[]> {
  const store = await loadVectors();

  if (!store || store.chunks.length === 0) {
    return [];
  }

  // 获取当前文章的所有 chunks
  const currentArticleChunks = store.chunks.filter(
    (chunk) => chunk.source === currentPath,
  );

  if (currentArticleChunks.length === 0) {
    return [];
  }

  // 计算当前文章的平均向量
  const currentArticleEmbedding =
    calculateArticleAverageEmbedding(currentArticleChunks);

  // 按文章分组计算相似度
  const articleSimilarities = new Map<
    string,
    {
      title: string;
      path: string;
      chunks: VectorStore["chunks"];
    }
  >();

  // 收集其他文章
  for (const chunk of store.chunks) {
    if (chunk.source === currentPath) continue;

    if (!articleSimilarities.has(chunk.source)) {
      articleSimilarities.set(chunk.source, {
        title: chunk.metadata.title,
        path: chunk.source,
        chunks: [],
      });
    }
    articleSimilarities.get(chunk.source)!.chunks.push(chunk);
  }

  // 计算每篇文章的相似度
  const results: RelatedPost[] = [];

  for (const [_, article] of articleSimilarities) {
    const articleEmbedding = calculateArticleAverageEmbedding(article.chunks);
    const similarity = cosineSimilarity(
      currentArticleEmbedding,
      articleEmbedding,
    );

    // 提取文章描述（使用第一个 chunk 的前 100 个字符）
    const firstChunk = article.chunks[0];
    const description = firstChunk
      ? firstChunk.content.replace(/\\r\\n/g, " ").slice(0, 100) + "..."
      : undefined;

    results.push({
      title: article.title,
      path: article.path,
      similarity,
      description,
    });
  }

  // 按相似度排序并返回 topK
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter((r) => r.similarity > 0.5); // 只返回相似度大于 0.5 的文章
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const currentPath = query.path as string;
  const topK = parseInt(query.topK as string) || 3;

  if (!currentPath) {
    throw createError({
      statusCode: 400,
      statusMessage: "缺少 path 参数",
    });
  }

  try {
    const relatedPosts = await getRelatedPosts(currentPath, topK);
    return {
      success: true,
      data: relatedPosts,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "获取相关文章失败",
    });
  }
});
