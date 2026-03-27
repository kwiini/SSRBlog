import { getEmbeddingCached as getEmbedding, cosineSimilarity } from "./embedding-cache"
import { promises as fs } from 'fs'
import { join } from 'path'

interface SearchResult {
  content: string
  source: string
  metadata: {
    title: string
    path: string
  }
  similarity: number
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

/**
 * 加载向量数据
 */
async function loadVectors(): Promise<VectorStore | null> {
  try {
    const data = await fs.readFile(VECTOR_STORE_PATH, 'utf-8')
    return JSON.parse(data) as VectorStore
  } catch {
    return null
  }
}

/**
 * 检索相关内容（按文章去重）
 * @param query 查询文本
 * @param topK 返回结果数量（按文章去重后的数量）
 * @returns 检索结果
 */
export async function retrieveContext(query: string, topK: number = 3): Promise<SearchResult[]> {
  const store = await loadVectors()

  if (!store || store.chunks.length === 0) {
    return []
  }

  // 获取查询的 embedding
  const queryEmbedding = await getEmbedding(query)

  // 计算相似度并排序
  const allResults = store.chunks
    .map(chunk => ({
      content: chunk.content,
      source: chunk.source,
      metadata: {
        title: chunk.metadata.title,
        path: chunk.metadata.path
      },
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .filter(r => r.similarity > 0.3)

  // 按文章去重，保留每个文章最相关的 chunk
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
 * 构建 RAG Prompt
 * @param question 用户问题
 * @param context 检索到的上下文
 * @returns 拼接后的 Prompt
 */
export function buildRAGPrompt(question: string, context: SearchResult[]): string {
  if (context.length === 0) {
    return question
  }

  // 格式化上下文
  const contextText = context
    .map((item, index) => {
      return `[${index + 1}] 来源：${item.metadata.title}\n内容：${item.content}`
    })
    .join('\n\n')

  // 构建 Prompt
  const prompt = `基于以下内容回答问题：

${contextText}

问题：
${question}

请根据上述内容回答问题，如果内容中没有相关信息，请说明无法回答。`

  return prompt
}

/**
 * RAG 查询（检索 + 生成 Prompt）
 * @param question 用户问题
 * @param topK 检索结果数量
 * @returns 包含上下文和 Prompt 的结果
 */
export async function ragQuery(
  question: string,
  topK: number = 3
): Promise<{
  question: string
  context: SearchResult[]
  prompt: string
  hasContext: boolean
}> {
  const context = await retrieveContext(question, topK)
  const prompt = buildRAGPrompt(question, context)

  return {
    question,
    context,
    prompt,
    hasContext: context.length > 0
  }
}
