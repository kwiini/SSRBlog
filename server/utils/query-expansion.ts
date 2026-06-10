/**
 * 查询扩展模块
 * 通过生成查询变体来提高召回率
 */

import { extractKeywords } from "./bm25";

/**
 * 同义词词典（简单示例）
 * 实际项目中可以使用更完整的同义词库
 */
const SYNONYM_DICT: Record<string, string[]> = {
  'js': ['javascript', 'java script'],
  'javascript': ['js', 'java script'],
  'ts': ['typescript', 'type script'],
  'typescript': ['ts', 'type script'],
  'py': ['python'],
  'python': ['py'],
  '前端': ['frontend', 'front-end', '客户端'],
  '后端': ['backend', 'back-end', '服务端', '服务器端'],
  '数据库': ['database', 'db', 'data store'],
  'api': ['接口', '应用程序接口'],
  '性能': ['优化', '速度', '效率', 'performance'],
  '安全': ['security', '防护', '漏洞', '攻击'],
  '部署': ['发布', '上线', 'delivery', 'deployment'],
  '测试': ['test', 'testing', '单元测试', '集成测试'],
  '框架': ['framework', '库', 'library'],
  '组件': ['component', '模块', 'module'],
  '路由': ['router', 'routing', '页面跳转'],
  '状态管理': ['state management', 'redux', 'vuex', 'pinia', 'store'],
  '缓存': ['cache', 'caching', '本地存储', 'localstorage'],
  '异步': ['async', 'promise', 'callback', '非阻塞'],
  '响应式': ['reactive', '响应', '双向绑定'],
};

/**
 * 获取词的同义词
 */
function getSynonyms(word: string): string[] {
  const lowerWord = word.toLowerCase();
  return SYNONYM_DICT[lowerWord] || [];
}

/**
 * 查询扩展结果
 */
export interface ExpandedQuery {
  original: string;
  variations: string[];
  keywords: string[];
  synonyms: Map<string, string[]>;
}

/**
 * 基础查询扩展
 * 提取关键词并生成同义词变体
 */
export function expandQuery(query: string): ExpandedQuery {
  const keywords = extractKeywords(query, 5);
  const synonyms = new Map<string, string[]>();
  const variations: string[] = [query];

  // 为每个关键词查找同义词
  for (const keyword of keywords) {
    const syns = getSynonyms(keyword);
    if (syns.length > 0) {
      synonyms.set(keyword, syns);
      
      // 生成替换同义词的查询变体
      for (const syn of syns.slice(0, 2)) {  // 限制同义词数量
        const variation = query.replace(new RegExp(keyword, 'gi'), syn);
        if (variation !== query && !variations.includes(variation)) {
          variations.push(variation);
        }
      }
    }
  }

  // 添加关键词组合查询
  if (keywords.length >= 2) {
    variations.push(keywords.join(' '));
  }

  return {
    original: query,
    variations: variations.slice(0, 5),  // 限制变体数量
    keywords,
    synonyms
  };
}

/**
 * HyDE (Hypothetical Document Embeddings)
 * 生成假设答案用于检索
 * 注意：这需要调用 LLM，实际使用时需要传入 LLM 调用函数
 */
export async function generateHypotheticalAnswer(
  query: string,
  llmCaller: (prompt: string) => Promise<string>
): Promise<string> {
  const prompt = `请根据以下问题，生成一段可能包含答案的文本段落。
这段文本应该类似于知识库中可能存在的文档内容。

问题：${query}

请生成一段 100-200 字的假设文档内容：

假设文档：`;

  try {
    const answer = await llmCaller(prompt);
    return answer.trim();
  } catch (error) {
    console.error('生成假设答案失败:', error);
    return query;  // 失败时返回原查询
  }
}

/**
 * 多查询生成
 * 从不同角度生成查询变体
 */
export function generateMultiQueries(query: string): string[] {
  const queries = [query];
  
  // 添加不同角度的查询
  const expansions = [
    `什么是${query}`,
    `${query}的原理`,
    `${query}的使用方法`,
    `${query}的最佳实践`,
    `${query}的常见问题`,
  ];
  
  // 根据查询长度选择合适的扩展
  if (query.length < 20) {
    queries.push(...expansions.slice(0, 2));
  }
  
  return queries.slice(0, 3);
}

/**
 * 查询重写 - 优化查询表达
 */
export function rewriteQuery(query: string): string {
  let rewritten = query.trim();
  
  // 移除多余空格
  rewritten = rewritten.replace(/\s+/g, ' ');
  
  // 如果查询是单个词，尝试扩展
  if (rewritten.length < 5 && !rewritten.includes(' ')) {
    const syns = getSynonyms(rewritten);
    if (syns.length > 0) {
      rewritten = `${rewritten} ${syns[0]}`;
    }
  }
  
  return rewritten;
}

/**
 * 完整的查询增强流程
 */
export async function enhanceQuery(
  query: string,
  options?: {
    useExpansion?: boolean;
    useHyDE?: boolean;
    llmCaller?: (prompt: string) => Promise<string>;
  }
): Promise<{ queries: string[]; hypotheticalDoc?: string }> {
  const result: { queries: string[]; hypotheticalDoc?: string } = {
    queries: [query]
  };
  
  // 1. 查询重写
  const rewritten = rewriteQuery(query);
  if (rewritten !== query) {
    result.queries.push(rewritten);
  }
  
  // 2. 查询扩展
  if (options?.useExpansion !== false) {
    const expanded = expandQuery(query);
    for (const variation of expanded.variations) {
      if (!result.queries.includes(variation)) {
        result.queries.push(variation);
      }
    }
  }
  
  // 3. HyDE (如果提供了 LLM 调用函数)
  if (options?.useHyDE && options?.llmCaller) {
    try {
      result.hypotheticalDoc = await generateHypotheticalAnswer(query, options.llmCaller);
    } catch (error) {
      console.error('HyDE 生成失败:', error);
    }
  }
  
  // 限制查询数量
  result.queries = result.queries.slice(0, 5);
  
  return result;
}
