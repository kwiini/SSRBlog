/**
 * 混合检索实现
 * 结合向量检索和 BM25 关键词检索
 */

import { getEmbeddingCached as getEmbedding, cosineSimilarity } from "./embedding-cache"
import { bm25Search, extractKeywords } from "./bm25"
import { expandQuery, generateMultiQueries } from "./query-expansion"
import { embeddingRerank, mmrRerank } from "./reranker"
import { promises as fs } from 'fs'
import { join } from 'path'

interface SearchResult {
  id: string
  content: string
  source: string
  metadata: {
    title: string
    path: string
    index: number
    total: number
  }
  similarity: number      // 向量相似度
  bm25Score: number      // BM25 分数
  hybridScore: number    // 混合分数
}

interface VectorStore {
  version: string
  lastUpdated: string
  chunks: Array<{
    id: string
    content: string
    embedding: number[]
    source: string
    metadata: {
      title: string
      path: string
      index: number
      total: number
    }
  }>
}

const VECTOR_STORE_PATH = join(process.cwd(), 'data', 'blog-vectors.json')

// 混合检索权重配置
const HYBRID_CONFIG = {
  vectorWeight: 0.6,     // 向量检索权重
  bm25Weight: 0.4,       // BM25 权重
  vectorThreshold: 0.3,  // 向量相似度阈值
  bm25Threshold: 0.1,    // BM25 分数阈值 (相对值)
  rerankTopK: 10         // 重排序前 K 个
}

// 向量数据内存缓存
let vectorCache: VectorStore | null = null
let vectorCacheTime = 0
const CACHE_TTL = 60000 // 60 秒缓存

/**
 * 加载向量数据（带缓存）
 */
async function loadVectors(): Promise<VectorStore | null> {
  const now = Date.now()
  
  // 检查缓存是否有效
  if (vectorCache && (now - vectorCacheTime) < CACHE_TTL) {
    return vectorCache
  }
  
  try {
    const data = await fs.readFile(VECTOR_STORE_PATH, 'utf-8')
    vectorCache = JSON.parse(data) as VectorStore
    vectorCacheTime = now
    return vectorCache
  } catch {
    return null
  }
}

/**
 * 清除向量缓存（在向量化后调用）
 */
export function clearVectorCache(): void {
  vectorCache = null
  vectorCacheTime = 0
}

/**
 * 归一化分数到 0-1 范围
 */
function normalizeScores(results: Array<{ score: number }>): number[] {
  if (results.length === 0) return []
  
  const scores = results.map(r => r.score)
  const maxScore = Math.max(...scores)
  const minScore = Math.min(...scores)
  
  if (maxScore === minScore) {
    return results.map(() => 1)
  }
  
  return scores.map(score => (score - minScore) / (maxScore - minScore))
}

/**
 * 向量检索
 */
async function vectorSearch(
  query: string,
  chunks: VectorStore['chunks'],
  topK: number
): Promise<Array<{ id: string; score: number; chunk: typeof chunks[0] }>> {
  const queryEmbedding = await getEmbedding(query)
  
  const results = chunks
    .map(chunk => ({
      id: chunk.id,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
      chunk
    }))
    .filter(r => r.score > HYBRID_CONFIG.vectorThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
  
  return results
}

/**
 * 混合检索 - 结合向量和关键词
 */
export async function hybridSearch(
  query: string,
  topK: number = 5,
  options?: {
    vectorWeight?: number
    bm25Weight?: number
  }
): Promise<SearchResult[]> {
  const store = await loadVectors()
  
  if (!store || store.chunks.length === 0) {
    return []
  }
  
  const weights = {
    vector: options?.vectorWeight ?? HYBRID_CONFIG.vectorWeight,
    bm25: options?.bm25Weight ?? HYBRID_CONFIG.bm25Weight
  }
  
  // 1. 执行向量检索
  const vectorResults = await vectorSearch(query, store.chunks, HYBRID_CONFIG.rerankTopK)
  
  // 2. 执行 BM25 检索
  const docsForBM25 = store.chunks.map(chunk => ({
    id: chunk.id,
    content: chunk.content,
    source: chunk.source,
    metadata: chunk.metadata
  }))
  const bm25Results = bm25Search(query, docsForBM25, HYBRID_CONFIG.rerankTopK)
  
  // 3. 归一化分数
  const normalizedVectorScores = normalizeScores(vectorResults)
  const normalizedBM25Scores = normalizeScores(bm25Results)
  
  // 4. 合并结果
  const resultMap = new Map<string, SearchResult>()
  
  // 添加向量结果
  vectorResults.forEach((result, index) => {
    const normalizedScore = normalizedVectorScores[index] ?? 0
    resultMap.set(result.id, {
      id: result.id,
      content: result.chunk.content,
      source: result.chunk.source,
      metadata: result.chunk.metadata,
      similarity: result.score,
      bm25Score: 0,
      hybridScore: normalizedScore * weights.vector
    })
  })
  
  // 添加/合并 BM25 结果
  bm25Results.forEach((result, index) => {
    const normalizedScore = normalizedBM25Scores[index] ?? 0
    const existing = resultMap.get(result.id)
    
    if (existing) {
      // 合并已有结果
      existing.bm25Score = result.score
      existing.hybridScore += normalizedScore * weights.bm25
    } else {
      // 添加新结果
      resultMap.set(result.id, {
        id: result.id,
        content: result.doc.content,
        source: result.doc.source,
        metadata: result.doc.metadata,
        similarity: 0,
        bm25Score: result.score,
        hybridScore: normalizedScore * weights.bm25
      })
    }
  })
  
  // 5. 按混合分数排序并过滤低质量结果
  const minThreshold = 0.15 // 最低混合分数阈值
  return Array.from(resultMap.values())
    .filter(r => r.hybridScore >= minThreshold)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, topK)
}

/**
 * 智能检索 - 自动选择检索策略
 * 短查询优先使用 BM25，长查询优先使用向量
 */
export async function smartSearch(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const queryLength = query.length
  const keywords = extractKeywords(query)
  
  // 根据查询特征调整权重
  let vectorWeight = HYBRID_CONFIG.vectorWeight
  let bm25Weight = HYBRID_CONFIG.bm25Weight
  
  // 短查询 (少于 10 个字符) - 增加 BM25 权重
  if (queryLength < 10) {
    vectorWeight = 0.4
    bm25Weight = 0.6
  }
  // 包含明确关键词的查询 - 增加 BM25 权重
  else if (keywords.length >= 3) {
    vectorWeight = 0.5
    bm25Weight = 0.5
  }
  // 长查询 (超过 50 个字符) - 增加向量权重
  else if (queryLength > 50) {
    vectorWeight = 0.7
    bm25Weight = 0.3
  }
  
  return hybridSearch(query, topK, { vectorWeight, bm25Weight })
}

/**
 * 按文章去重的混合检索
 * 保留每篇文章最相关的 chunk
 */
export async function hybridSearchUnique(
  query: string,
  topK: number = 3
): Promise<SearchResult[]> {
  const allResults = await smartSearch(query, topK * 3)
  
  // 按文章去重
  const seenSources = new Set<string>()
  const uniqueResults: SearchResult[] = []
  
  for (const result of allResults) {
    if (!seenSources.has(result.source)) {
      seenSources.add(result.source)
      uniqueResults.push(result)
      if (uniqueResults.length >= topK) {
        break
      }
    }
  }
  
  return uniqueResults
}

/**
 * 多查询检索 - 使用查询扩展提高召回率
 */
export async function multiQuerySearch(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  // 1. 生成查询变体
  const expanded = expandQuery(query)
  const multiQueries = generateMultiQueries(query)
  
  // 合并所有查询（去重）
  const allQueries = [...new Set([query, ...expanded.variations, ...multiQueries])].slice(0, 5)
  
  console.log(`[MultiQuery] 执行 ${allQueries.length} 个查询变体:`, allQueries)
  
  // 2. 对每个查询执行检索
  const allResults = await Promise.all(
    allQueries.map(q => smartSearch(q, topK * 2))
  )
  
  // 3. 合并结果并去重
  const resultMap = new Map<string, SearchResult & { count: number }>()
  
  for (const results of allResults) {
    for (const result of results) {
      const existing = resultMap.get(result.id)
      if (existing) {
        // 如果已存在，取最高分数并增加计数
        existing.hybridScore = Math.max(existing.hybridScore, result.hybridScore)
        existing.similarity = Math.max(existing.similarity, result.similarity)
        existing.count += 1
      } else {
        resultMap.set(result.id, { ...result, count: 1 })
      }
    }
  }
  
  // 4. 按混合分数和出现次数排序
  return Array.from(resultMap.values())
    .sort((a, b) => {
      // 优先按出现次数排序，其次按分数
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return b.hybridScore - a.hybridScore
    })
    .slice(0, topK)
    .map(({ count, ...result }) => result)
}

/**
 * 带重排序的混合检索
 */
export async function hybridSearchWithRerank(
  query: string,
  topK: number = 5,
  options?: {
    useMMR?: boolean;        // 是否使用 MMR 多样性重排序
    mmrLambda?: number;      // MMR 平衡参数
  }
): Promise<SearchResult[]> {
  // 1. 先获取更多候选结果
  const candidates = await smartSearch(query, topK * 3)
  
  // 2. 使用 embedding 重排序
  const reranked = await embeddingRerank(
    query,
    candidates.map(c => ({
      id: c.id,
      content: c.content,
      source: c.source,
      metadata: c.metadata,
      score: c.hybridScore
    })),
    { topK: topK * 2 }
  )
  
  // 3. 可选：使用 MMR 增加多样性
  if (options?.useMMR) {
    const mmrResults = await mmrRerank(
      query,
      reranked.map(r => ({
        id: r.id,
        content: r.content,
        source: r.source,
        metadata: r.metadata,
        score: r.rerankScore
      })),
      { topK, lambda: options.mmrLambda || 0.5 }
    )
    
    return mmrResults.map(r => ({
      id: r.id,
      content: r.content,
      source: r.source,
      metadata: r.metadata,
      similarity: r.score,
      bm25Score: 0,
      hybridScore: r.mmrScore
    }))
  }
  
  // 4. 返回最终结果
  return reranked.slice(0, topK).map(r => ({
    id: r.id,
    content: r.content,
    source: r.source,
    metadata: r.metadata,
    similarity: r.originalScore,
    bm25Score: 0,
    hybridScore: r.rerankScore
  }))
}


