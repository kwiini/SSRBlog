/**
 * Embedding 工具 - 使用缓存优化版本
 * 为了保持向后兼容，导出缓存版本的函数
 */

export {
  getEmbeddingCached as getEmbedding,
  getEmbeddingsCached as getEmbeddings,
  cosineSimilarity,
  getCacheStats,
  clearCache
} from './embedding-cache'
