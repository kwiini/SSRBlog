/**
 * 混合检索(向量 KNN + BM25 + LLM Cross-Encoder 重排 + 可选 MMR)
 *
 * 典型流程: hybridSearchUnique(query, topK, { useMMR, llmCaller })
 *   1. 扩大召回: vector KNN(走 sqlite-vec) + BM25 联合,先各取 topK*3
 *   2. 按文章去重: 同一篇文章只保留最相关的一个 chunk
 *   3. LLM Cross-Encoder 精排: 把 (query, doc) 一起喂给 LLM, 逐条打分(可被 LLM 响应缓存)
 *   4. 可选 MMR: 在相关性 vs 多样性之间平衡
 *
 * 向量召回走 server/retrieval/vector-db 的 KNN(MATCH 算子)。
 * BM25 仍走全表扫描(sqlite-vec 暂不替代全文检索)。
 */

import { getEmbeddingCached as getEmbedding } from "./vector";
import { bm25Search, extractKeywords } from "./bm25";
import { embeddingRerank, llmRerank, mmrRerank } from "./reranker";
import { callLLM } from "../core/llm/client";
import {
  getAllChunksCached,
  clearAllChunksCache,
  searchByVector,
  type ChunkRecord,
} from "./vector-db";

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
  bm25Score: number;
  hybridScore: number;
}

const HYBRID_CONFIG = {
  vectorWeight: 0.6,
  bm25Weight: 0.4,
  vectorThreshold: 0.3,
  bm25Threshold: 0.1,
  rerankTopK: 10,
};

/** 兼容旧 API:清空 in-memory chunk 缓存 */
export function clearVectorCache(): void {
  clearAllChunksCache();
}

function normalizeScores(results: Array<{ score: number }>): number[] {
  if (results.length === 0) return [];

  const scores = results.map((r) => r.score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  if (maxScore === minScore) {
    return results.map(() => 1);
  }

  return scores.map((score) => (score - minScore) / (maxScore - minScore));
}

function chunkToBm25Doc(c: ChunkRecord) {
  return {
    id: c.id,
    content: c.content,
    source: c.source,
    metadata: {
      title: c.title,
      path: c.path,
      index: c.chunkIndex,
      total: c.chunkTotal,
    },
  };
}

async function vectorSearch(
  query: string,
  chunks: ChunkRecord[],
  topK: number,
): Promise<Array<{ id: string; score: number; chunk: ChunkRecord }>> {
  const queryEmbedding = await getEmbedding(query);

  // sqlite-vec 内部已经按 distance 排好,直接走 KNN
  const hits = searchByVector(queryEmbedding, {
    topK,
    threshold: HYBRID_CONFIG.vectorThreshold,
  });
  const chunkById = new Map(chunks.map((c) => [c.id, c]));
  return hits
    .map((h) => ({
      id: h.id,
      score: h.similarity,
      chunk: chunkById.get(h.id)!,
    }))
    .filter((r) => r.chunk);
}

/**
 * 混合检索(向量 + BM25)
 */
export async function hybridSearch(
  query: string,
  topK: number = 5,
  options?: {
    vectorWeight?: number;
    bm25Weight?: number;
  },
): Promise<SearchResult[]> {
  const chunks = getAllChunksCached();

  if (chunks.length === 0) {
    return [];
  }

  const weights = {
    vector: options?.vectorWeight ?? HYBRID_CONFIG.vectorWeight,
    bm25: options?.bm25Weight ?? HYBRID_CONFIG.bm25Weight,
  };

  const vectorResults = await vectorSearch(
    query,
    chunks,
    HYBRID_CONFIG.rerankTopK,
  );

  const docsForBM25 = chunks.map(chunkToBm25Doc);
  const bm25Results = bm25Search(query, docsForBM25, HYBRID_CONFIG.rerankTopK);

  const normalizedVectorScores = normalizeScores(vectorResults);
  const normalizedBM25Scores = normalizeScores(bm25Results);

  const resultMap = new Map<string, SearchResult>();

  vectorResults.forEach((result, index) => {
    const normalizedScore = normalizedVectorScores[index] ?? 0;
    resultMap.set(result.id, {
      id: result.id,
      content: result.chunk.content,
      source: result.chunk.source,
      metadata: {
        title: result.chunk.title,
        path: result.chunk.path,
        index: result.chunk.chunkIndex,
        total: result.chunk.chunkTotal,
      },
      similarity: result.score,
      bm25Score: 0,
      hybridScore: normalizedScore * weights.vector,
    });
  });

  bm25Results.forEach((result, index) => {
    const normalizedScore = normalizedBM25Scores[index] ?? 0;
    const existing = resultMap.get(result.id);

    if (existing) {
      existing.bm25Score = result.score;
      existing.hybridScore += normalizedScore * weights.bm25;
    } else {
      resultMap.set(result.id, {
        id: result.id,
        content: result.doc.content,
        source: result.doc.source,
        metadata: result.doc.metadata,
        similarity: 0,
        bm25Score: result.score,
        hybridScore: normalizedScore * weights.bm25,
      });
    }
  });

  const minThreshold = 0.15;
  return Array.from(resultMap.values())
    .filter((r) => r.hybridScore >= minThreshold)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, topK);
}

/**
 * 智能检索 - 根据查询长度/关键词调整权重
 */
export async function smartSearch(
  query: string,
  topK: number = 5,
): Promise<SearchResult[]> {
  const queryLength = query.length;
  const keywords = extractKeywords(query);

  let vectorWeight = HYBRID_CONFIG.vectorWeight;
  let bm25Weight = HYBRID_CONFIG.bm25Weight;

  if (queryLength < 10) {
    vectorWeight = 0.4;
    bm25Weight = 0.6;
  } else if (keywords.length >= 3) {
    vectorWeight = 0.5;
    bm25Weight = 0.5;
  } else if (queryLength > 50) {
    vectorWeight = 0.7;
    bm25Weight = 0.3;
  }

  return hybridSearch(query, topK, { vectorWeight, bm25Weight });
}

/**
 * 完整检索: 召回 → 去重 → LLM Cross-Encoder 精排 → 可选 MMR
 */
export async function hybridSearchUnique(
  query: string,
  topK: number = 3,
  options?: {
    useMMR?: boolean;
    mmrLambda?: number;
    useFastRerank?: boolean;
    llmCaller?: (prompt: string) => Promise<string>;
  },
): Promise<SearchResult[]> {
  // 1. 扩大召回
  const allResults = await smartSearch(query, topK * 3);

  // 2. 按文章去重
  const seenSources = new Set<string>();
  const uniqueResults: SearchResult[] = [];

  for (const result of allResults) {
    if (!seenSources.has(result.source)) {
      seenSources.add(result.source);
      uniqueResults.push(result);
    }
  }

  if (uniqueResults.length === 0) {
    return [];
  }

  // 3. 精排
  const docsForRerank = uniqueResults.map((r) => ({
    id: r.id,
    content: r.content,
    source: r.source,
    metadata: r.metadata,
  }));

  const reranked = options?.useFastRerank
    ? await embeddingRerank(
        query,
        uniqueResults.map((r) => ({
          id: r.id,
          content: r.content,
          source: r.source,
          metadata: r.metadata,
          score: r.hybridScore,
        })),
        { topK: uniqueResults.length },
      )
    : await llmRerank(query, docsForRerank, options?.llmCaller || callLLM, {
        topK: uniqueResults.length,
      });

  // 4. 可选 MMR 多样性
  let finalResults = reranked;
  if (options?.useMMR) {
    const mmrResults = await mmrRerank(
      query,
      reranked.map((r) => ({
        id: r.id,
        content: r.content,
        source: r.source,
        metadata: r.metadata,
        score: r.rerankScore,
      })),
      { topK, lambda: options.mmrLambda ?? 0.5 },
    );
    finalResults = mmrResults as any;
  } else {
    finalResults = reranked.slice(0, topK);
  }

  // 合并重排分数到 SearchResult
  return finalResults.map((r: any) => {
    const original = uniqueResults.find((u) => u.id === r.id);
    return {
      id: r.id,
      content: r.content,
      source: r.source,
      metadata: r.metadata,
      similarity: original?.similarity || 0,
      bm25Score: original?.bm25Score || 0,
      hybridScore: r.rerankScore ?? r.mmrScore ?? original?.hybridScore ?? 0,
    };
  });
}
