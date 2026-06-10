/**
 * 重排序模块
 * 使用交叉编码器（Cross-Encoder）提升检索结果的相关性
 * 
 * 注意：完整的交叉编码器需要额外的模型服务
 * 这里提供接口和基于 LLM 的轻量级实现
 */

import { getEmbeddingCached as getEmbedding, cosineSimilarity } from "./embedding-cache";

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
  useLLM?: boolean;           // 是否使用 LLM 进行重排序
  llmCaller?: (prompt: string) => Promise<string>;
  minScore?: number;          // 最小分数阈值
}

/**
 * 基于嵌入的轻量级重排序
 * 使用查询与文档的交互特征进行评分
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
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  if (documents.length === 0) return [];

  const { topK = documents.length, minScore = 0.1 } = options;

  // 获取查询的 embedding
  const queryEmbedding = await getEmbedding(query);

  // 计算增强分数
  const reranked = await Promise.all(
    documents.map(async (doc) => {
      // 1. 基础向量相似度
      const docEmbedding = await getEmbedding(doc.content);
      const vectorScore = cosineSimilarity(queryEmbedding, docEmbedding);

      // 2. 标题匹配分数
      const titleEmbedding = await getEmbedding(doc.metadata.title);
      const titleScore = cosineSimilarity(queryEmbedding, titleEmbedding);

      // 3. 关键词匹配分数
      const keywordScore = calculateKeywordScore(query, doc.content, doc.metadata.title);

      // 4. 长度归一化分数（避免过长文档）
      const lengthScore = Math.min(1, 300 / doc.content.length);

      // 5. 综合分数（加权组合）
      const rerankScore = 
        vectorScore * 0.4 +
        titleScore * 0.3 +
        keywordScore * 0.2 +
        lengthScore * 0.1;

      return {
        ...doc,
        originalScore: doc.score || vectorScore,
        rerankScore
      };
    })
  );

  return reranked
    .filter(r => r.rerankScore >= minScore)
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);
}

/**
 * 计算关键词匹配分数
 */
function calculateKeywordScore(query: string, content: string, title: string): number {
  const queryWords = extractWords(query);
  const contentWords = extractWords(content);
  const titleWords = extractWords(title);

  let score = 0;

  for (const word of queryWords) {
    // 标题匹配权重更高
    const titleMatches = titleWords.filter(w => w.includes(word) || word.includes(w)).length;
    const contentMatches = contentWords.filter(w => w.includes(word) || word.includes(w)).length;

    score += titleMatches * 0.3 + Math.min(contentMatches * 0.05, 0.2);
  }

  return Math.min(score, 1);
}

/**
 * 提取词汇
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

/**
 * 基于 LLM 的重排序
 * 使用 LLM 判断文档与查询的相关性
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
  options: { topK?: number } = {}
): Promise<RerankResult[]> {
  if (documents.length === 0) return [];

  const { topK = documents.length } = options;

  // 构建重排序提示
  const docsText = documents
    .map((doc, idx) => `[${idx + 1}] 标题: ${doc.metadata.title}\n内容: ${doc.content.substring(0, 200)}...`)
    .join('\n\n');

  const prompt = `请评估以下文档与用户查询的相关性。

用户查询: ${query}

文档列表:
${docsText}

请为每个文档评分（0-10分），并返回 JSON 格式:
{
  "scores": [
    {"index": 1, "score": 8.5, "reason": "直接回答了查询"},
    {"index": 2, "score": 3.0, "reason": "部分相关"}
  ]
}

只返回 JSON，不要其他内容。`;

  try {
    const response = await llmCaller(prompt);
    const parsed = JSON.parse(response);
    const scores = parsed.scores || [];

    // 合并分数
    const reranked = documents.map((doc, idx) => {
      const scoreEntry = scores.find((s: any) => s.index === idx + 1);
      const llmScore = scoreEntry ? scoreEntry.score / 10 : 0.5;

      return {
        ...doc,
        originalScore: 0,
        rerankScore: llmScore
      };
    });

    return reranked
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK);

  } catch (error) {
    console.error('LLM 重排序失败:', error);
    // 失败时返回原始顺序
    return documents.map(doc => ({
      ...doc,
      originalScore: 0,
      rerankScore: 0.5
    }));
  }
}

/**
 * 递归重排序（Reciprocal Rank Fusion）
 * 合并多个排序结果
 */
export function reciprocalRankFusion(
  rankings: Array<Array<{ id: string; score: number }>>,
  k: number = 60
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();

  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const item = ranking[i];
      const currentScore = item?.id ? (scores.get(item.id) || 0) : 0;
      // RRF 公式: 1 / (k + rank)
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
 * 多样性重排序（MMR - Maximal Marginal Relevance）
 * 在相关性和多样性之间平衡
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
  options: { topK?: number; lambda?: number } = {}
): Promise<Array<typeof documents[0] & { mmrScore: number }>> {
  const { topK = documents.length, lambda = 0.5 } = options;

  if (documents.length === 0) return [];

  // 获取所有文档的 embedding
  const docEmbeddings = await Promise.all(
    documents.map(async doc => ({
      doc,
      embedding: await getEmbedding(doc.content)
    }))
  );

  const selected: Array<typeof documents[0] & { mmrScore: number }> = [];
  const remaining = [...docEmbeddings];

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestMMRScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      if (!item) continue;
      const { doc, embedding } = item;

      // 相关性部分
      const relevance = doc.score;

      // 多样性部分（与已选文档的最大相似度）
      let maxSim = 0;
      for (const selectedItem of selected) {
        const selectedEmbedding = docEmbeddings.find(de => de.doc.id === selectedItem.id)?.embedding;
        if (selectedEmbedding) {
          const sim = cosineSimilarity(embedding, selectedEmbedding);
          maxSim = Math.max(maxSim, sim);
        }
      }

      // MMR 分数
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;

      if (mmrScore > bestMMRScore) {
        bestMMRScore = mmrScore;
        bestIdx = i;
      }
    }

    const best = remaining.splice(bestIdx, 1)[0];
    if (best) {
      selected.push({ ...best?.doc, mmrScore: bestMMRScore });
    }
  }

  return selected;
}

export type { RerankResult, RerankOptions };
