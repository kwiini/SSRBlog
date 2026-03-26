/**
 * Embedding 缓存与优化工具
 * 提供 LRU 缓存、请求去重、批量合并和并发控制
 */

import { createHash } from 'crypto'

interface CacheEntry {
  embedding: number[]
  timestamp: number
  accessCount: number
}

interface PendingRequest {
  promise: Promise<number[]>
  timestamp: number
}

// 缓存配置
const CACHE_CONFIG = {
  maxSize: 1000,        // 最大缓存条目数
  ttl: 24 * 60 * 60 * 1000,  // 缓存有效期 24 小时
  cleanupInterval: 60 * 60 * 1000  // 清理间隔 1 小时
}

// 请求合并配置
const BATCH_CONFIG = {
  maxBatchSize: 100,    // 单次批量请求最大数量
  maxWaitTime: 50,      // 最大等待时间 ms
  maxConcurrent: 5      // 最大并发请求数
}

// 内存缓存
const embeddingCache = new Map<string, CacheEntry>()
const pendingRequests = new Map<string, PendingRequest>()

// 批量请求队列
interface BatchItem {
  text: string
  hash: string
  resolve: (embedding: number[]) => void
  reject: (error: any) => void
}

let batchQueue: BatchItem[] = []
let batchTimeout: NodeJS.Timeout | null = null
let activeRequests = 0

/**
 * 生成文本哈希（用于缓存键）
 */
function generateHash(text: string): string {
  return createHash('md5').update(text).digest('hex')
}

/**
 * 清理过期缓存
 */
function cleanupCache(): void {
  const now = Date.now()
  let cleaned = 0
  
  for (const [key, entry] of embeddingCache.entries()) {
    if (now - entry.timestamp > CACHE_CONFIG.ttl) {
      embeddingCache.delete(key)
      cleaned++
    }
  }
  
  // 如果缓存仍然过大，删除最少使用的
  if (embeddingCache.size > CACHE_CONFIG.maxSize) {
    const sorted = Array.from(embeddingCache.entries())
      .sort((a, b) => a[1].accessCount - b[1].accessCount)
    
    const toDelete = sorted.slice(0, sorted.length - CACHE_CONFIG.maxSize)
    for (const [key] of toDelete) {
      embeddingCache.delete(key)
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Embedding Cache] Cleaned ${cleaned} entries, remaining: ${embeddingCache.size}`)
  }
}

// 定期清理
setInterval(cleanupCache, CACHE_CONFIG.cleanupInterval)

/**
 * 从缓存获取 embedding
 */
function getFromCache(hash: string): number[] | null {
  const entry = embeddingCache.get(hash)
  if (!entry) return null
  
  // 检查是否过期
  if (Date.now() - entry.timestamp > CACHE_CONFIG.ttl) {
    embeddingCache.delete(hash)
    return null
  }
  
  // 更新访问计数
  entry.accessCount++
  return entry.embedding
}

/**
 * 保存到缓存
 */
function saveToCache(hash: string, embedding: number[]): void {
  // 如果缓存已满，先清理
  if (embeddingCache.size >= CACHE_CONFIG.maxSize) {
    cleanupCache()
  }
  
  embeddingCache.set(hash, {
    embedding,
    timestamp: Date.now(),
    accessCount: 1
  })
}

/**
 * 实际调用 API 批量获取 embeddings
 */
async function fetchEmbeddingsFromAPI(texts: string[]): Promise<number[][]> {
  const config = useRuntimeConfig()
  const apiKey = config.llmApiKey
  const baseURL = config.llmBaseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  const embeddingModel = config.embeddingModel || 'text-embedding-v3'

  if (!apiKey) {
    throw new Error('LLM API Key 未配置')
  }

  const response = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: texts,
      encoding_format: 'float'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Embedding API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  if (data.data && Array.isArray(data.data)) {
    return data.data.map((item: any) => item.embedding)
  }
  
  throw new Error('Invalid embedding response format')
}

/**
 * 处理批量队列
 */
async function processBatch(): Promise<void> {
  if (batchQueue.length === 0 || activeRequests >= BATCH_CONFIG.maxConcurrent) {
    return
  }
  
  // 取出一批请求
  const batch = batchQueue.slice(0, BATCH_CONFIG.maxBatchSize)
  batchQueue = batchQueue.slice(BATCH_CONFIG.maxBatchSize)
  
  activeRequests++
  
  try {
    const texts = batch.map(item => item.text)
    const embeddings = await fetchEmbeddingsFromAPI(texts)
    
    // 分发结果
    batch.forEach((item, index) => {
      const embedding = embeddings[index]
      if (embedding) {
        saveToCache(item.hash, embedding)
        item.resolve(embedding)
      } else {
        item.reject(new Error('Embedding not found in response'))
      }
    })
  } catch (error) {
    // 失败时全部 reject
    batch.forEach(item => item.reject(error))
  } finally {
    activeRequests--
    
    // 继续处理剩余队列
    if (batchQueue.length > 0) {
      processBatch()
    }
  }
}

/**
 * 获取单个文本的 embedding（带缓存和批量优化）
 */
export async function getEmbeddingCached(text: string): Promise<number[]> {
  const hash = generateHash(text)
  
  // 1. 检查缓存
  const cached = getFromCache(hash)
  if (cached) {
    return cached
  }
  
  // 2. 检查是否有正在进行的请求（去重）
  const pending = pendingRequests.get(hash)
  if (pending && Date.now() - pending.timestamp < 30000) {
    return pending.promise
  }
  
  // 3. 创建新请求
  const promise = new Promise<number[]>((resolve, reject) => {
    // 加入批量队列
    batchQueue.push({
      text,
      hash,
      resolve,
      reject
    })
    
    // 设置批量处理定时器
    if (!batchTimeout) {
      batchTimeout = setTimeout(() => {
        batchTimeout = null
        processBatch()
      }, BATCH_CONFIG.maxWaitTime)
    }
    
    // 立即触发处理（如果并发数允许）
    if (activeRequests < BATCH_CONFIG.maxConcurrent) {
      processBatch()
    }
  })
  
  // 记录进行中的请求
  pendingRequests.set(hash, {
    promise,
    timestamp: Date.now()
  })
  
  // 完成后清理
  promise.finally(() => {
    pendingRequests.delete(hash)
  })
  
  return promise
}

/**
 * 批量获取 embeddings（带缓存优化）
 */
export async function getEmbeddingsCached(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  const uncached: { text: string; index: number }[] = []
  
  // 先检查缓存
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]
    const hash = generateHash(text!)
    const cached = getFromCache(hash)
    
    if (cached) {
      results[i] = cached
    } else {
      uncached.push({ text: text!, index: i })
    }
  }
  
  // 如果全部命中缓存，直接返回
  if (uncached.length === 0) {
    return results
  }
  
  // 对未缓存的文本进行批量获取
  if (uncached.length > 0) {
    const uncachedTexts = uncached.map(item => item.text)
    const embeddings = await fetchEmbeddingsFromAPI(uncachedTexts)
    
    // 填充结果并缓存
    for (let i = 0; i < uncached.length; i++) {
      const embedding = embeddings[i]
      const item = uncached[i]
      
      if (embedding) {
        results[item!.index] = embedding
        saveToCache(generateHash(item!.text), embedding)
      }
    }
  }
  
  return results
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats() {
  return {
    size: embeddingCache.size,
    maxSize: CACHE_CONFIG.maxSize,
    pendingRequests: pendingRequests.size,
    batchQueueLength: batchQueue.length,
    activeRequests
  }
}

/**
 * 清除缓存
 */
export function clearCache(): void {
  embeddingCache.clear()
  console.log('[Embedding Cache] Cache cleared')
}

// 导出原有的 cosineSimilarity
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += (vec1[i] ?? 0) * (vec2[i] ?? 0)
    norm1 += (vec1[i] ?? 0) * (vec1[i] ?? 0)
    norm2 += (vec2[i] ?? 0) * (vec2[i] ?? 0)
  }

  if (norm1 === 0 || norm2 === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
}
