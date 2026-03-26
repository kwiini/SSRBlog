import { getEmbedding, getEmbeddings, cosineSimilarity } from "../utils/embedding"

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { text, texts, compare } = body

    // 单文本 embedding
    if (text && typeof text === 'string') {
      const embedding = await getEmbedding(text)
      return {
        success: true,
        embedding,
        dimensions: embedding.length
      }
    }

    // 批量 embedding
    if (texts && Array.isArray(texts)) {
      const embeddings = await getEmbeddings(texts)
      return {
        success: true,
        embeddings,
        count: embeddings.length,
        dimensions: embeddings[0]?.length
      }
    }

    // 相似度比较
    if (compare && Array.isArray(compare) && compare.length === 2) {
      const [text1, text2] = compare
      const [emb1, emb2] = await getEmbeddings([text1, text2])
      const similarity = cosineSimilarity(emb1!, emb2!)
      
      return {
        success: true,
        similarity,
        text1,
        text2
      }
    }

    throw createError({
      statusCode: 400,
      statusMessage: '请提供 text、texts 或 compare 参数'
    })
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Embedding 请求失败'
    })
  }
})
