import { logger } from "../../lib/logger";

/**
 * LLM 响应缓存
 * - LRU 淘汰(按 accessCount)
 * - TTL 过期
 * - 缓存键: model + system + user 的 md5
 */

interface LLMEntry {
  response: string;
  timestamp: number;
  accessCount: number;
}

const LLM_CACHE_CONFIG = {
  maxSize: 500, // 最大缓存条目数
  ttl: 24 * 60 * 60 * 1000, // 缓存有效期 24 小时
  cleanupInterval: 60 * 60 * 1000, // 清理间隔 1 小时
};

const llmCache = new Map<string, LLMEntry>();

function cleanupLLMCache(): void {
  const now = Date.now();
  for (const [key, entry] of llmCache.entries()) {
    if (now - entry.timestamp > LLM_CACHE_CONFIG.ttl) {
      llmCache.delete(key);
    }
  }
  if (llmCache.size > LLM_CACHE_CONFIG.maxSize) {
    const sorted = Array.from(llmCache.entries()).sort(
      (a, b) => a[1].accessCount - b[1].accessCount,
    );
    const toDelete = sorted.slice(0, sorted.length - LLM_CACHE_CONFIG.maxSize);
    for (const [key] of toDelete) llmCache.delete(key);
  }
}

setInterval(cleanupLLMCache, LLM_CACHE_CONFIG.cleanupInterval);

export function getFromLLMCache(key: string): string | null {
  const entry = llmCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > LLM_CACHE_CONFIG.ttl) {
    llmCache.delete(key);
    return null;
  }
  entry.accessCount++;
  return entry.response;
}

export function saveToLLMCache(key: string, response: string): void {
  if (llmCache.size >= LLM_CACHE_CONFIG.maxSize) {
    cleanupLLMCache();
  }
  llmCache.set(key, {
    response,
    timestamp: Date.now(),
    accessCount: 1,
  });
}

/** LLM 缓存统计 */
export function getLLMCacheStats() {
  return {
    size: llmCache.size,
    maxSize: LLM_CACHE_CONFIG.maxSize,
  };
}

/** 清除 LLM 缓存 */
export function clearLLMCache(): void {
  llmCache.clear();
  logger.info("[LLM Cache] Cache cleared");
}
