/**
 * RAG 检索服务
 *
 * 流程:ragQuery(question, options)
 *   1. 检索上下文
 *      - 复杂查询自动触发 step-back / decomposition(走 enhanceQuery)
 *      - HyDE 启用时把假设文档也加入检索
 *      - 多 query 变体并发检索后按 content 前 120 字符去重合并
 *   2. 上下文压缩(默认 600 字,Jaccard 去重 + 关键词密度排序)
 *   3. 拼接 RAG Prompt(交由 core/prompts 集中托管)
 *
 * buildRAGPrompt / buildSimpleRAGPrompt 单独导出供流式接口复用。
 */

import { hybridSearchUnique } from "../retrieval/hybrid"
import { extractKeywords } from "../retrieval/bm25"
import { enhanceQuery } from "../retrieval/query-expansion"
import { compressContext } from "../processors/context-compressor"
import { callLLM } from "../core/llm/client"
import { RAGPrompts } from "../core/prompts"

interface SearchResult {
  content: string;
  source: string;
  metadata: {
    title: string;
    path: string;
  };
  similarity: number;
  bm25Score?: number;
  hybridScore?: number;
}

/**
 * 检索相关内容(混合检索:向量 + BM25 + LLM Cross-Encoder 重排)
 */
export async function retrieveContext(
  query: string,
  topK: number = 3,
): Promise<SearchResult[]> {
  const hybridResults = await hybridSearchUnique(query, topK);

  return hybridResults.map(result => ({
    content: result.content,
    source: result.source,
    metadata: result.metadata,
    similarity: result.similarity,
    bm25Score: result.bm25Score,
    hybridScore: result.hybridScore
  }));
}

/**
 * 用 enhanceQuery 后的多 query 并发检索 + 去重合并
 * 集成 step-back / decomposition / hyde / expansion 等所有策略
 */
async function retrieveWithEnhancedQueries(
  question: string,
  options: RAGQueryOptions,
): Promise<SearchResult[]> {
  const { topK = 3, useHyDE, useMultiQuery, useStepBack, useDecomposition, llmCaller } = options;

  const enhanced = await enhanceQuery(question, {
    useExpansion: useMultiQuery,
    useHyDE,
    useStepBack,
    useDecomposition,
    llmCaller,
  });

  const allQueries = new Set<string>(enhanced.queries);
  if (enhanced.hypotheticalDoc) {
    allQueries.add(enhanced.hypotheticalDoc);
  }

  console.log(
    `[RAG] enhanced strategies=${enhanced.strategies.join(",") || "none"} ` +
    `isComplex=${enhanced.isComplex} queries=${allQueries.size}`,
  );

  const perQuery = Math.max(2, Math.ceil((topK * 2) / Math.max(1, allQueries.size)));
  const allResultsLists = await Promise.all(
    Array.from(allQueries).map(q => retrieveContext(q, perQuery)),
  );

  // 按 content 前 120 字作为指纹去重
  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const list of allResultsLists) {
    for (const r of list) {
      const key = r.content.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
  }

  return merged.slice(0, Math.max(topK * 2, 6));
}

/**
 * 提取查询关键词(供调试)
 */
export function getQueryKeywords(query: string): string[] {
  return extractKeywords(query);
}

/**
 * 构建 RAG Prompt
 */
export function buildRAGPrompt(
  question: string,
  context: SearchResult[],
): string {
  if (context.length === 0) {
    return RAGPrompts.noContext(question)
  }
  return RAGPrompts.withContext(question, context)
}

/**
 * 简化版 RAG Prompt
 */
export function buildSimpleRAGPrompt(
  question: string,
  context: SearchResult[],
): string {
  if (context.length === 0) {
    return question
  }
  return RAGPrompts.simple(question, context)
}

/**
 * RAG 查询配置
 */
export interface RAGQueryOptions {
  topK?: number;
  useMultiQuery?: boolean;
  useCompression?: boolean;
  maxContextLength?: number;
  useHyDE?: boolean;
  useStepBack?: boolean;
  useDecomposition?: boolean;
  llmCaller?: (prompt: string) => Promise<string>;
}

/**
 * RAG 查询(检索 + 生成 Prompt)
 */
export async function ragQuery(
  question: string,
  options: RAGQueryOptions = {},
): Promise<{
  question: string;
  context: SearchResult[];
  prompt: string;
  hasContext: boolean;
  keywords: string[];
}> {
  const {
    topK = 3,
    useMultiQuery = false,
    useCompression = true,
    maxContextLength = 600,
    useHyDE = true,
    llmCaller
  } = options;

  // 1. 检索上下文
  let context: SearchResult[];
  if (useHyDE || useMultiQuery || options.useStepBack || options.useDecomposition) {
    const caller = llmCaller ?? callLLM;
    context = await retrieveWithEnhancedQueries(question, {
      ...options,
      llmCaller: caller,
    });
  } else {
    context = await retrieveContext(question, topK);
  }

  // 2. 上下文压缩
  if (useCompression && context.length > 0) {
    context = compressContext(context, question, {
      maxLength: maxContextLength,
      removeDuplicates: true,
      keepSentences: 8
    });
  }

  // 3. 提取关键词
  const keywords = extractKeywords(question);

  // 4. 构建 RAG Prompt
  const prompt = buildRAGPrompt(question, context);

  return {
    question,
    context,
    prompt,
    hasContext: context.length > 0,
    keywords,
  };
}

/**
 * 便捷的 RAG 查询函数(保持向后兼容)
 */
export async function ragQuerySimple(
  question: string,
  topK: number = 3
): Promise<{
  question: string;
  context: SearchResult[];
  prompt: string;
  hasContext: boolean;
}> {
  const result = await ragQuery(question, { topK });
  return {
    question: result.question,
    context: result.context,
    prompt: result.prompt,
    hasContext: result.hasContext
  };
}
