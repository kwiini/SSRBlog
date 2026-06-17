/**
 * 重排序(Reranker)
 *
 * - llmRerank:真正的 Cross-Encoder。把 (query, doc) 一起喂给 LLM,联合理解后逐条打分。
 *   比 embedding 双塔点积准一个量级,但延迟更高、成本更贵(可被 LLM 响应缓存部分抵消)
 * - embeddingRerank:轻量替代。各自算 doc/query embedding 再点积,无 query-doc 交互。
 * - mmrRerank:Maximal Marginal Relevance。lambda * 相关性 - (1-lambda) * 与已选最大相似度,
 *   在相关性与多样性之间平衡,避免 topK 都被同一篇博客的不同 chunk 占据
 * - reciprocalRankFusion:多路排序结果融合(1/(k+rank) 求和),用于 cross-encoder + BM25 融合
 */

import { getEmbeddingCached as getEmbedding, cosineSimilarity } from "./vector";
import { RerankPrompts } from "../core/prompts";

import { logger } from "../lib/logger";

interface RerankResult {
  id: string;
  content: string;
  source: string;
  metadata: {
    title: string;
    path: string;
    index: number;
    total: number;
  };
  originalScore: number;
  rerankScore: number;
}

interface RerankOptions {
  topK?: number;
  useLLM?: boolean;
  llmCaller?: (prompt: string) => Promise<string>;
  minScore?: number;
}

/**
 * 轻量级重排序(双塔式,非 Cross-Encoder)
 * 速度比 llmRerank 快一个量级,但精度低。仅在延迟极敏感或 LLM 不可用时使用。
 */
export async function embeddingRerank(
  query: string,
  documents: Array<{
    id: string;
    content: string;
    source: string;
    metadata: {
      title: string;
      path: string;
      index: number;
      total: number;
    };
    score?: number;
  }>,
  options: RerankOptions = {},
): Promise<RerankResult[]> {
  if (documents.length === 0) return [];

  const { topK = documents.length, minScore = 0.1 } = options;

  const queryEmbedding = await getEmbedding(query);

  const reranked = await Promise.all(
    documents.map(async (doc) => {
      const docEmbedding = await getEmbedding(doc.content);
      const vectorScore = cosineSimilarity(queryEmbedding, docEmbedding);

      const titleEmbedding = await getEmbedding(doc.metadata.title);
      const titleScore = cosineSimilarity(queryEmbedding, titleEmbedding);

      const keywordScore = calculateKeywordScore(
        query,
        doc.content,
        doc.metadata.title,
      );

      const lengthScore = Math.min(1, 300 / doc.content.length);

      const rerankScore =
        vectorScore * 0.4 +
        titleScore * 0.3 +
        keywordScore * 0.2 +
        lengthScore * 0.1;

      return {
        ...doc,
        originalScore: doc.score || vectorScore,
        rerankScore,
      };
    }),
  );

  return reranked
    .filter((r) => r.rerankScore >= minScore)
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);
}

/**
 * 关键词匹配分数
 */
function calculateKeywordScore(
  query: string,
  content: string,
  title: string,
): number {
  const queryWords = extractWords(query);
  const contentWords = extractWords(content);
  const titleWords = extractWords(title);

  let score = 0;

  for (const word of queryWords) {
    const titleMatches = titleWords.filter(
      (w) => w.includes(word) || word.includes(w),
    ).length;
    const contentMatches = contentWords.filter(
      (w) => w.includes(word) || word.includes(w),
    ).length;

    score += titleMatches * 0.3 + Math.min(contentMatches * 0.05, 0.2);
  }

  return Math.min(score, 1);
}

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/**
 * 基于 LLM 的重排序(真正的 Cross-Encoder)
 */
export async function llmRerank(
  query: string,
  documents: Array<{
    id: string;
    content: string;
    source: string;
    metadata: {
      title: string;
      path: string;
      index: number;
      total: number;
    };
  }>,
  llmCaller: (prompt: string) => Promise<string>,
  options: { topK?: number } = {},
): Promise<RerankResult[]> {
  if (documents.length === 0) return [];

  const { topK = documents.length } = options;

  const docsText = documents
    .map(
      (doc, idx) =>
        `[${idx + 1}] 标题: ${doc.metadata.title}\n内容: ${doc.content.substring(0, 200)}...`,
    )
    .join("\n\n");

  const prompt = RerankPrompts.llmCrossEncoder(query, docsText);

  try {
    const response = await llmCaller(prompt);
    const parsed = JSON.parse(response);
    const scores = parsed.scores || [];

    const reranked = documents.map((doc, idx) => {
      const scoreEntry = scores.find((s: any) => s.index === idx + 1);
      const llmScore = scoreEntry ? scoreEntry.score / 10 : 0.5;

      return {
        ...doc,
        originalScore: 0,
        rerankScore: llmScore,
      };
    });

    return reranked
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK);
  } catch (error) {
    logger.error("LLM 重排序失败:", error);
    return documents.map((doc) => ({
      ...doc,
      originalScore: 0,
      rerankScore: 0.5,
    }));
  }
}

/**
 * Reciprocal Rank Fusion:合并多路排序结果
 */
export function reciprocalRankFusion(
  rankings: Array<Array<{ id: string; score: number }>>,
  k: number = 60,
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();

  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const item = ranking[i];
      const currentScore = item?.id ? scores.get(item.id) || 0 : 0;
      if (item?.id) {
        scores.set(item.id, currentScore + 1 / (k + i + 1));
      }
    }
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Maximal Marginal Relevance 多样性重排序
 */
export async function mmrRerank(
  query: string,
  documents: Array<{
    id: string;
    content: string;
    source: string;
    metadata: {
      title: string;
      path: string;
      index: number;
      total: number;
    };
    score: number;
  }>,
  options: { topK?: number; lambda?: number } = {},
): Promise<Array<(typeof documents)[0] & { mmrScore: number }>> {
  const { topK = documents.length, lambda = 0.5 } = options;

  if (documents.length === 0) return [];

  const docEmbeddings = await Promise.all(
    documents.map(async (doc) => ({
      doc,
      embedding: await getEmbedding(doc.content),
    })),
  );

  const selected: Array<(typeof documents)[0] & { mmrScore: number }> = [];
  const remaining = [...docEmbeddings];

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestMMRScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      if (!item) continue;
      const { doc, embedding } = item;

      const relevance = doc.score;

      let maxSim = 0;
      for (const selectedItem of selected) {
        const selectedEmbedding = docEmbeddings.find(
          (de) => de.doc.id === selectedItem.id,
        )?.embedding;
        if (selectedEmbedding) {
          const sim = cosineSimilarity(embedding, selectedEmbedding);
          maxSim = Math.max(maxSim, sim);
        }
      }

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;

      if (mmrScore > bestMMRScore) {
        bestMMRScore = mmrScore;
        bestIdx = i;
      }
    }

    const best = remaining.splice(bestIdx, 1)[0];
    if (best) {
      selected.push({ ...best.doc, mmrScore: bestMMRScore });
    }
  }

  return selected;
}

export type { RerankResult, RerankOptions };
