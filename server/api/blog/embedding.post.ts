import {
  getEmbeddingCached as getEmbedding,
  getEmbeddingsCached as getEmbeddings,
  cosineSimilarity,
} from "../../retrieval/vector";

/**
 * POST /api/blog/embedding
 * 单文本 / 批量 / 相似度比较
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { text, texts, compare } = body;

    if (text && typeof text === "string") {
      const embedding = await getEmbedding(text);
      return {
        success: true,
        embedding,
        dimensions: embedding.length,
      };
    }

    if (texts && Array.isArray(texts)) {
      const embeddings = await getEmbeddings(texts);
      return {
        success: true,
        embeddings,
        count: embeddings.length,
        dimensions: embeddings[0]?.length,
      };
    }

    if (compare && Array.isArray(compare) && compare.length === 2) {
      const [text1, text2] = compare;
      const [emb1, emb2] = await getEmbeddings([text1, text2]);
      const similarity = cosineSimilarity(emb1!, emb2!);

      return {
        success: true,
        similarity,
        text1,
        text2,
      };
    }

    throw createError({
      statusCode: 400,
      message: "请提供 text、texts 或 compare 参数",
    });
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || "Embedding 请求失败",
    });
  }
});
