import { hybridSearchUnique, multiQuerySearch } from "./hybrid-search";
import { extractKeywords } from "./bm25";
import { compressContext } from "./context-compressor";

interface SearchResult {
  content: string;
  source: string;
  metadata: {
    title: string;
    path: string;
  };
  similarity: number;
  bm25Score?: number;
  hybridScore?: number;
}

/**
 * 检索相关内容（使用混合检索）
 * @param query 查询文本
 * @param topK 返回结果数量
 * @returns 检索结果
 */
export async function retrieveContext(
  query: string,
  topK: number = 3,
): Promise<SearchResult[]> {
  // 使用混合检索（向量 + BM25）
  const hybridResults = await hybridSearchUnique(query, topK);

  // 转换为 SearchResult 格式
  return hybridResults.map(result => ({
    content: result.content,
    source: result.source,
    metadata: result.metadata,
    similarity: result.similarity,
    bm25Score: result.bm25Score,
    hybridScore: result.hybridScore
  }));
}

/**
 * 查询扩展 - 提取关键词用于调试
 */
export function getQueryKeywords(query: string): string[] {
  return extractKeywords(query);
}

/**
 * 获取相关度等级
 */
function getRelevanceLevel(score: number): string {
  if (score >= 0.7) return '高';
  if (score >= 0.5) return '中';
  return '低';
}

/**
 * 构建 RAG Prompt - 优化版本
 * @param question 用户问题
 * @param context 检索到的上下文
 * @returns 拼接后的 Prompt
 */
export function buildRAGPrompt(
  question: string,
  context: SearchResult[],
): string {
  if (context.length === 0) {
    return `你是博客内容的智能助手。用户提出了一个问题，但博客中没有找到相关的参考资料。

请直接回答用户问题，并说明"未在博客中找到相关资料，以下回答基于我的通用知识"。

## 用户问题：
${question}

请回答：`;
  }

  // 按混合分数排序并格式化上下文
  const sortedContext = context
    .sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0))
    .map((item, index) => {
      const relevance = getRelevanceLevel(item.hybridScore || item.similarity);
      const score = ((item.hybridScore || item.similarity) * 100).toFixed(1);
      return `[${index + 1}] [相关度:${relevance} ${score}%] 来源：${item.metadata.title}\n内容：${item.content}`;
    })
    .join("\n\n---\n\n");

  // 构建优化后的 Prompt
  const prompt = `你是博客内容的智能助手。请基于以下参考资料回答用户问题。

## 参考资料（按相关度排序）：

${sortedContext}

---

## 回答要求：
1. **优先使用高相关度资料**（标记为"高"的参考资料更可靠）
2. **综合多个来源** - 如果多个资料都相关，请整合信息给出完整回答
3. **忠实于资料** - 只回答资料中包含的信息，不要编造
4. **明确标注来源** - 在回答中引用参考资料编号，如 [1]、[2]
5. **处理信息不足的情况** - 如果资料不足以回答问题，请明确说明"根据现有资料无法确定"
6. **区分事实和推断** - 基于资料的事实 vs 你的合理推断

## 用户问题：
${question}

请根据上述要求回答问题：`;

  return prompt;
}

/**
 * 构建简化版 RAG Prompt（用于快速响应）
 */
export function buildSimpleRAGPrompt(
  question: string,
  context: SearchResult[],
): string {
  if (context.length === 0) {
    return question;
  }

  const contextText = context
    .map((item, index) => `[${index + 1}] ${item.metadata.title}\n${item.content}`)
    .join("\n\n");

  return `基于以下内容回答问题：\n\n${contextText}\n\n问题：${question}\n\n请根据资料回答，标注来源编号。`;
}

/**
 * RAG 查询配置
 */
export interface RAGQueryOptions {
  topK?: number;
  useMultiQuery?: boolean;      // 是否使用多查询扩展
  useCompression?: boolean;     // 是否启用上下文压缩
  maxContextLength?: number;    // 上下文最大长度
}

/**
 * RAG 查询（检索 + 生成 Prompt）
 * @param question 用户问题
 * @param options 查询配置选项
 * @returns 包含上下文和 Prompt 的结果
 */
export async function ragQuery(
  question: string,
  options: RAGQueryOptions = {},
): Promise<{
  question: string;
  context: SearchResult[];
  prompt: string;
  hasContext: boolean;
  keywords: string[];
}> {
  const {
    topK = 3,
    useMultiQuery = false,
    useCompression = true,
    maxContextLength = 600
  } = options;

  // 1. 检索上下文（可选择使用多查询）
  let context: SearchResult[];
  if (useMultiQuery) {
    const multiResults = await multiQuerySearch(question, topK * 2);
    context = multiResults.map(r => ({
      content: r.content,
      source: r.source,
      metadata: r.metadata,
      similarity: r.similarity,
      bm25Score: r.bm25Score,
      hybridScore: r.hybridScore
    }));
  } else {
    context = await retrieveContext(question, topK);
  }

  // 2. 上下文压缩
  if (useCompression && context.length > 0) {
    context = compressContext(context, question, {
      maxLength: maxContextLength,
      removeDuplicates: true,
      keepSentences: 8
    });
  }

  // 3. 提取关键词（用于调试）
  const keywords = extractKeywords(question);

  // 4. 构建 RAG Prompt
  const prompt = buildRAGPrompt(question, context);

  return {
    question,
    context,
    prompt,
    hasContext: context.length > 0,
    keywords,
  };
}

/**
 * 便捷的 RAG 查询函数（保持向后兼容）
 */
export async function ragQuerySimple(
  question: string,
  topK: number = 3
): Promise<{
  question: string;
  context: SearchResult[];
  prompt: string;
  hasContext: boolean;
}> {
  const result = await ragQuery(question, { topK });
  return {
    question: result.question,
    context: result.context,
    prompt: result.prompt,
    hasContext: result.hasContext
  };
}
