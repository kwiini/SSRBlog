/**
 * BM25 关键词检索实现
 * 用于混合检索中的关键词匹配部分
 */

interface Document {
  id: string
  content: string
  source: string
  metadata: {
    title: string
    path: string
    index: number
    total: number
  }
}

interface BM25Score {
  id: string
  score: number
  doc: Document
}

// BM25 参数
const BM25_PARAMS = {
  k1: 1.5,  // 词频饱和参数
  b: 0.75   // 文档长度归一化参数
}

/**
 * 中文分词 - 简单实现
 * 实际项目中可以使用 jieba 等分词库
 */
function tokenize(text: string): string[] {
  // 清理文本
  const cleanText = text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')  // 只保留中文、英文、数字
    .trim()
  
  // 简单分词：按字符分割中文，按空格分割英文
  const tokens: string[] = []
  let currentWord = ''
  
  for (const char of cleanText) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      // 中文字符，单独成词
      if (currentWord) {
        tokens.push(currentWord)
        currentWord = ''
      }
      tokens.push(char)
    } else if (/\s/.test(char)) {
      // 空格，结束当前词
      if (currentWord) {
        tokens.push(currentWord)
        currentWord = ''
      }
    } else {
      currentWord += char
    }
  }
  
  if (currentWord) {
    tokens.push(currentWord)
  }
  
  return tokens
}

/**
 * 计算词频
 */
function computeTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1)
  }
  return tf
}

/**
 * 计算文档平均长度
 */
function computeAvgDocLength(docs: Document[]): number {
  if (docs.length === 0) return 0
  const totalLength = docs.reduce((sum, doc) => sum + tokenize(doc.content).length, 0)
  return totalLength / docs.length
}

/**
 * 计算 IDF (逆文档频率)
 */
function computeIDF(term: string, docs: Document[]): number {
  const docCount = docs.length
  const docsWithTerm = docs.filter(doc => {
    const tokens = tokenize(doc.content)
    return tokens.includes(term)
  }).length
  
  // 使用 BM25 的 IDF 公式
  return Math.log(1 + (docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5))
}

/**
 * 计算 BM25 分数
 */
function computeBM25Score(
  query: string,
  doc: Document,
  avgDocLength: number,
  idfCache: Map<string, number>
): number {
  const queryTokens = tokenize(query)
  const docTokens = tokenize(doc.content)
  const docLength = docTokens.length
  const docTF = computeTermFrequency(docTokens)
  
  let score = 0
  
  for (const term of queryTokens) {
    const tf = docTF.get(term) || 0
    if (tf === 0) continue
    
    // 获取或计算 IDF
    let idf = idfCache.get(term)
    if (idf === undefined) {
      idf = computeIDF(term, [doc])
      idfCache.set(term, idf)
    }
    
    // BM25 公式
    const numerator = tf * (BM25_PARAMS.k1 + 1)
    const denominator = tf + BM25_PARAMS.k1 * (1 - BM25_PARAMS.b + BM25_PARAMS.b * docLength / avgDocLength)
    
    score += idf * numerator / denominator
  }
  
  // 标题匹配加权
  const titleTokens = tokenize(doc.metadata.title)
  for (const term of queryTokens) {
    if (titleTokens.includes(term)) {
      score *= 1.5  // 标题匹配加权 50%
    }
  }
  
  return score
}

/**
 * BM25 搜索
 * @param query 查询字符串
 * @param docs 文档集合
 * @param topK 返回结果数量
 * @returns 按分数排序的结果
 */
export function bm25Search(
  query: string,
  docs: Document[],
  topK: number = 10
): Array<{ id: string; score: number; doc: Document }> {
  if (!query.trim() || docs.length === 0) {
    return []
  }
  
  const avgDocLength = computeAvgDocLength(docs)
  const idfCache = new Map<string, number>()
  
  // 计算每个文档的分数
  const scores: BM25Score[] = docs.map(doc => ({
    id: doc.id,
    score: computeBM25Score(query, doc, avgDocLength, idfCache),
    doc
  }))
  
  // 按分数排序并返回前 K 个
  return scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/**
 * 提取查询关键词
 * 用于查询扩展
 */
export function extractKeywords(text: string, maxKeywords: number = 5): string[] {
  const tokens = tokenize(text)
  const tf = computeTermFrequency(tokens)
  
  // 过滤停用词 (简单列表)
  const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'])
  
  // 按词频排序
  const sortedTerms = Array.from(tf.entries())
    .filter(([term]) => !stopWords.has(term) && term.length > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([term]) => term)
  
  return sortedTerms
}
