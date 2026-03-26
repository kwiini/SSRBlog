interface EmbeddingResponse {
  embedding: number[]
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

/**
 * 获取文本的向量嵌入
 * @param text 输入文本
 * @returns 向量数组
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const config = useRuntimeConfig()
  
  const apiKey = config.llmApiKey
  const baseURL = config.llmBaseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  const embeddingModel = config.embeddingModel || 'text-embedding-v3'

  if (!apiKey) {
    throw new Error('LLM API Key 未配置')
  }

  try {
    const response = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: text,
        encoding_format: 'float'
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Embedding API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    
    // 提取向量数据
    if (data.data && data.data[0] && data.data[0].embedding) {
      return data.data[0].embedding
    }
    
    throw new Error('Invalid embedding response format')
  } catch (error: any) {
    throw new Error(`获取 Embedding 失败: ${error.message}`)
  }
}

/**
 * 批量获取文本的向量嵌入
 * @param texts 文本数组
 * @returns 向量数组的数组
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const config = useRuntimeConfig()
  
  const apiKey = config.llmApiKey
  const baseURL = config.llmBaseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  const embeddingModel = config.embeddingModel || 'text-embedding-v3'

  if (!apiKey) {
    throw new Error('LLM API Key 未配置')
  }

  try {
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
    
    // 提取所有向量数据
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((item: any) => item.embedding)
    }
    
    throw new Error('Invalid embedding response format')
  } catch (error: any) {
    throw new Error(`获取 Embeddings 失败: ${error.message}`)
  }
}

/**
 * 计算两个向量的余弦相似度
 * @param vec1 向量1
 * @param vec2 向量2
 * @returns 相似度分数 (0-1)
 */
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

/**
 * 计算向量之间的欧几里得距离
 * @param vec1 向量1
 * @param vec2 向量2
 * @returns 距离
 */
export function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length')
  }

  let sum = 0
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.pow((vec1[i] ?? 0) - (vec2[i] ?? 0), 2)
  }

  return Math.sqrt(sum)
}
