/**
 * BM25 关键词检索
 * - 中文用 Intl.Segmenter 按词切,避免单字成词导致 IDF 退化
 * - 标题命中加权 1.5x
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

const BM25_PARAMS = {
  k1: 1.5,
  b: 0.75,
}

const zhSegmenter = new Intl.Segmenter('zh', { granularity: 'word' })

export function tokenize(text: string): string[] {
  if (!text) return []

  const tokens: string[] = []
  for (const { segment, isWordLike } of zhSegmenter.segment(text.toLowerCase())) {
    if (isWordLike) {
      tokens.push(segment)
    }
  }
  return tokens
}

function computeTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1)
  }
  return tf
}

function computeAvgDocLength(docs: Document[]): number {
  if (docs.length === 0) return 0
  const totalLength = docs.reduce((sum, doc) => sum + tokenize(doc.content).length, 0)
  return totalLength / docs.length
}

function computeIDF(term: string, docs: Document[]): number {
  const docCount = docs.length
  const docsWithTerm = docs.filter(doc => {
    const tokens = tokenize(doc.content)
    return tokens.includes(term)
  }).length

  return Math.log(1 + (docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5))
}

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

    let idf = idfCache.get(term)
    if (idf === undefined) {
      idf = computeIDF(term, [doc])
      idfCache.set(term, idf)
    }

    const numerator = tf * (BM25_PARAMS.k1 + 1)
    const denominator = tf + BM25_PARAMS.k1 * (1 - BM25_PARAMS.b + BM25_PARAMS.b * docLength / avgDocLength)

    score += idf * numerator / denominator
  }

  // 标题匹配加权
  const titleTokens = tokenize(doc.metadata.title)
  for (const term of queryTokens) {
    if (titleTokens.includes(term)) {
      score *= 1.5
    }
  }

  return score
}

/**
 * BM25 搜索
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

  const scores: BM25Score[] = docs.map(doc => ({
    id: doc.id,
    score: computeBM25Score(query, doc, avgDocLength, idfCache),
    doc
  }))

  return scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/**
 * 提取查询关键词(供 query-expansion 用)
 */
export function extractKeywords(text: string, maxKeywords: number = 5): string[] {
  const tokens = tokenize(text)
  const tf = computeTermFrequency(tokens)

  const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'])

  const sortedTerms = Array.from(tf.entries())
    .filter(([term]) => !stopWords.has(term) && term.length > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([term]) => term)

  return sortedTerms
}
