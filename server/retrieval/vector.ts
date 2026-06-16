/**
 * Embedding 缓存与向量运算
 * - LRU 缓存(按 accessCount 淘汰)
 * - TTL 过期(24h)
 * - 请求去重(同 hash 30s 内复用同一 promise)
 * - 批量合并(50ms 窗口最多 100 条/批,5 并发)
 * - 余弦相似度
 *
 * 这是双塔向量检索的"塔侧"——只算单边 embedding 后做点积，没有 query-doc 交互。
 * 真正的 cross-encoder 形态在 ./reranker.ts(LLM 重排)。
 */

import { createHash } from "crypto";

import { logger } from "../lib/logger";

// · 缓存条目
interface CacheEntry {
  embedding: number[];
  timestamp: number;
  accessCount: number;
}

// · 待处理请求条目
interface PendingRequest {
  promise: Promise<number[]>;
  timestamp: number;
}

// 缓存配置
const CACHE_CONFIG = {
  maxSize: 1000,
  ttl: 24 * 60 * 60 * 1000,
  cleanupInterval: 60 * 60 * 1000,
};

// 请求合并配置
const BATCH_CONFIG = {
  maxBatchSize: 100,
  maxWaitTime: 50,
  maxConcurrent: 5,
};

const embeddingCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, PendingRequest>();

interface BatchItem {
  text: string;
  hash: string;
  resolve: (embedding: number[]) => void;
  reject: (error: any) => void;
}

let batchQueue: BatchItem[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
let activeRequests = 0;

function generateHash(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

function cleanupCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of embeddingCache.entries()) {
    if (now - entry.timestamp > CACHE_CONFIG.ttl) {
      embeddingCache.delete(key);
      cleaned++;
    }
  }

  if (embeddingCache.size > CACHE_CONFIG.maxSize) {
    const sorted = Array.from(embeddingCache.entries()).sort(
      (a, b) => a[1].accessCount - b[1].accessCount,
    );

    const toDelete = sorted.slice(0, sorted.length - CACHE_CONFIG.maxSize);
    for (const [key] of toDelete) {
      embeddingCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(
      `[Embedding Cache] Cleaned ${cleaned} entries, remaining: ${embeddingCache.size}`,
    );
  }
}

setInterval(cleanupCache, CACHE_CONFIG.cleanupInterval);

function getFromCache(hash: string): number[] | null {
  const entry = embeddingCache.get(hash);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_CONFIG.ttl) {
    embeddingCache.delete(hash);
    return null;
  }

  entry.accessCount++;
  return entry.embedding;
}

function saveToCache(hash: string, embedding: number[]): void {
  if (embeddingCache.size >= CACHE_CONFIG.maxSize) {
    cleanupCache();
  }

  embeddingCache.set(hash, {
    embedding,
    timestamp: Date.now(),
    accessCount: 1,
  });
}

async function fetchEmbeddingsFromAPI(texts: string[]): Promise<number[][]> {
  const config = useRuntimeConfig();
  const apiKey = config.llmApiKey;
  const baseURL =
    config.llmBaseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const embeddingModel = config.embeddingModel || "text-embedding-v3";

  if (!apiKey) {
    throw new Error("LLM API Key 未配置");
  }

  const response = await fetch(`${baseURL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: texts,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (data.data && Array.isArray(data.data)) {
    return data.data.map((item: any) => item.embedding);
  }

  throw new Error("Invalid embedding response format");
}

async function processBatch(): Promise<void> {
  if (batchQueue.length === 0 || activeRequests >= BATCH_CONFIG.maxConcurrent) {
    return;
  }

  const batch = batchQueue.slice(0, BATCH_CONFIG.maxBatchSize);
  batchQueue = batchQueue.slice(BATCH_CONFIG.maxBatchSize);

  activeRequests++;

  try {
    const texts = batch.map((item) => item.text);
    const embeddings = await fetchEmbeddingsFromAPI(texts);

    batch.forEach((item, index) => {
      const embedding = embeddings[index];
      if (embedding) {
        saveToCache(item.hash, embedding);
        item.resolve(embedding);
      } else {
        item.reject(new Error("Embedding not found in response"));
      }
    });
  } catch (error) {
    batch.forEach((item) => item.reject(error));
  } finally {
    activeRequests--;

    if (batchQueue.length > 0) {
      processBatch();
    }
  }
}

/**
 * 获取单个文本的 embedding(带缓存、批量合并、请求去重)
 */
export async function getEmbeddingCached(text: string): Promise<number[]> {
  const hash = generateHash(text);

  const cached = getFromCache(hash);
  if (cached) {
    return cached;
  }

  const pending = pendingRequests.get(hash);
  if (pending && Date.now() - pending.timestamp < 30000) {
    return pending.promise;
  }

  const promise = new Promise<number[]>((resolve, reject) => {
    batchQueue.push({
      text,
      hash,
      resolve,
      reject,
    });

    if (!batchTimeout) {
      batchTimeout = setTimeout(() => {
        batchTimeout = null;
        processBatch();
      }, BATCH_CONFIG.maxWaitTime);
    }

    if (activeRequests < BATCH_CONFIG.maxConcurrent) {
      processBatch();
    }
  });

  pendingRequests.set(hash, {
    promise,
    timestamp: Date.now(),
  });

  promise.finally(() => {
    pendingRequests.delete(hash);
  });

  return promise;
}

/**
 * 批量获取 embeddings(带缓存优化)
 */
export async function getEmbeddingsCached(
  texts: string[],
): Promise<number[][]> {
  const results: number[][] = [];
  const uncached: { text: string; index: number }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const hash = generateHash(text!);
    const cached = getFromCache(hash);

    if (cached) {
      results[i] = cached;
    } else {
      uncached.push({ text: text!, index: i });
    }
  }

  if (uncached.length === 0) {
    return results;
  }

  if (uncached.length > 0) {
    const uncachedTexts = uncached.map((item) => item.text);
    const embeddings = await fetchEmbeddingsFromAPI(uncachedTexts);

    for (let i = 0; i < uncached.length; i++) {
      const embedding = embeddings[i];
      const item = uncached[i];

      if (embedding) {
        results[item!.index] = embedding;
        saveToCache(generateHash(item!.text), embedding);
      }
    }
  }

  return results;
}

/** 缓存统计 */
export function getCacheStats() {
  return {
    size: embeddingCache.size,
    maxSize: CACHE_CONFIG.maxSize,
    pendingRequests: pendingRequests.size,
    batchQueueLength: batchQueue.length,
    activeRequests,
  };
}

/** 清除 embedding 缓存 */
export function clearCache(): void {
  embeddingCache.clear();
  logger.info("[Embedding Cache] Cache cleared");
}

/** 余弦相似度 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i]! * vec2[i]!;
    norm1 += vec1[i]! * vec1[i]!;
    norm2 += vec2[i]! * vec2[i]!;
  }

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
