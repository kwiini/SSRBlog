/**
 * 查询扩展
 *  - 同义词变体(本地 SYNONYM_DICT,零成本)
 *  - LLM 改写(可选,口语化 → 检索友好)
 *  - Step-back(把具体问题抽象成上位问题,扩大召回)
 *  - Decomposition(把复合问题拆成 2-4 个子问题,逐个检索)
 *  - HyDE(生成假设文档,拿它的 embedding 去做检索)
 */

import { extractKeywords } from "./bm25";
import { EnhancePrompts, HyDEPrompts, QueryPrompts } from "../core/prompts";

import { logger } from "../lib/logger";

const SYNONYM_DICT: Record<string, string[]> = {
  js: ["javascript", "java script"],
  javascript: ["js", "java script"],
  ts: ["typescript", "type script"],
  typescript: ["ts", "type script"],
  py: ["python"],
  python: ["py"],
  前端: ["frontend", "front-end", "客户端"],
  后端: ["backend", "back-end", "服务端", "服务器端"],
  数据库: ["database", "db", "data store"],
  api: ["接口", "应用程序接口"],
  性能: ["优化", "速度", "效率", "performance"],
  安全: ["security", "防护", "漏洞", "攻击"],
  部署: ["发布", "上线", "delivery", "deployment"],
  测试: ["test", "testing", "单元测试", "集成测试"],
  框架: ["framework", "库", "library"],
  组件: ["component", "模块", "module"],
  路由: ["router", "routing", "页面跳转"],
  状态管理: ["state management", "redux", "vuex", "pinia", "store"],
  缓存: ["cache", "caching", "本地存储", "localstorage"],
  异步: ["async", "promise", "callback", "非阻塞"],
  响应式: ["reactive", "响应", "双向绑定"],
};

function getSynonyms(word: string): string[] {
  const lowerWord = word.toLowerCase();
  return SYNONYM_DICT[lowerWord] || [];
}

export interface ExpandedQuery {
  original: string;
  variations: string[];
  keywords: string[];
  synonyms: Map<string, string[]>;
}

/**
 * 基础查询扩展(本地同义词,无 LLM)
 */
export function expandQuery(query: string): ExpandedQuery {
  const keywords = extractKeywords(query, 5);
  const synonyms = new Map<string, string[]>();
  const variations: string[] = [query];

  for (const keyword of keywords) {
    const syns = getSynonyms(keyword);
    if (syns.length > 0) {
      synonyms.set(keyword, syns);

      for (const syn of syns.slice(0, 2)) {
        const variation = query.replace(new RegExp(keyword, "gi"), syn);
        if (variation !== query && !variations.includes(variation)) {
          variations.push(variation);
        }
      }
    }
  }

  if (keywords.length >= 2) {
    variations.push(keywords.join(" "));
  }

  return {
    original: query,
    variations: variations.slice(0, 5),
    keywords,
    synonyms,
  };
}

/**
 * HyDE (Hypothetical Document Embeddings)
 */
export async function generateHypotheticalAnswer(
  query: string,
  llmCaller: (prompt: string) => Promise<string>,
): Promise<string> {
  const prompt = HyDEPrompts.hypotheticalDoc(query);

  try {
    const answer = await llmCaller(prompt);
    return answer.trim();
  } catch (error) {
    logger.error("生成假设答案失败:", error);
    return query;
  }
}

/**
 * 多查询生成
 */
export function generateMultiQueries(query: string): string[] {
  const queries = [query];

  const expansions = [
    `什么是${query}`,
    `${query}的原理`,
    `${query}的使用方法`,
    `${query}的最佳实践`,
    `${query}的常见问题`,
  ];

  if (query.length < 20) {
    queries.push(...expansions.slice(0, 2));
  }

  return queries.slice(0, 3);
}

function rewriteQueryBasic(query: string): string {
  let rewritten = query.trim();
  rewritten = rewritten.replace(/\s+/g, " ");

  if (rewritten.length < 5 && !rewritten.includes(" ")) {
    const syns = getSynonyms(rewritten);
    if (syns.length > 0) {
      rewritten = `${rewritten} ${syns[0] ?? ""}`.trim();
    }
  }

  return rewritten;
}

function shouldUseLLMRewrite(query: string): boolean {
  if (!query) return false;
  if (query.length > 200) return false;
  if (query.trim().length < 2) return false;
  return true;
}

/**
 * 查询重写 - LLM 改写为更利于检索的短查询
 */
export async function rewriteQuery(
  query: string,
  llmCaller?: (prompt: string) => Promise<string>,
): Promise<string> {
  const basic = rewriteQueryBasic(query);

  if (!llmCaller || !shouldUseLLMRewrite(basic)) {
    return basic;
  }

  try {
    const prompt = QueryPrompts.rewrite(basic);
    const raw = await llmCaller(prompt);
    const rewritten =
      raw
        .replace(/^改写后[：:]\s*/g, "")
        .replace(/^["'「」`]+|["'「」`]+$/g, "")
        .trim()
        .split(/\r?\n/)[0]
        ?.slice(0, 80) ?? "";
    return rewritten || basic;
  } catch (error) {
    logger.error("[query-rewrite] LLM 改写失败，回退到 basic:", error);
    return basic;
  }
}

/* ──────────── Step-back / 子问题分解 ──────────── */

/**
 * 复杂查询判定
 */
export function isComplexQuery(query: string): boolean {
  if (!query) return false;
  const q = query.trim();

  if (/(区别|差异|对比|比较|不同|相同|优劣|好处|坏处|vs\.?|versus)/i.test(q)) {
    return true;
  }

  if (/(在.{2,15}中|在.{2,15}下|在.{2,15}时|基于|通过.{2,15}实现)/.test(q)) {
    return true;
  }

  if (/[、，]/.test(q)) return true;
  if (/(?:和|与|及)\s*[\u4e00-\u9fa5A-Za-z]{2,}/.test(q)) return true;

  if (q.length >= 30) return true;

  if ((q.match(/[？?]/g) || []).length >= 2) return true;

  return false;
}

/**
 * Step-back
 */
export async function stepBackQuery(
  query: string,
  llmCaller: (prompt: string) => Promise<string>,
): Promise<string | null> {
  try {
    const raw = await llmCaller(EnhancePrompts.stepBack(query));
    const cleaned =
      raw
        .replace(/^上位问题[：:]\s*/g, "")
        .replace(/^["'「」`]+|["'「」`]+$/g, "")
        .trim()
        .split(/\r?\n/)[0]
        ?.slice(0, 100) ?? "";
    return cleaned || null;
  } catch (err) {
    logger.error("[stepBackQuery] LLM 调用失败:", err);
    return null;
  }
}

/**
 * Decomposition
 */
export async function decomposeQuery(
  query: string,
  llmCaller: (prompt: string) => Promise<string>,
): Promise<string[]> {
  try {
    const raw = await llmCaller(EnhancePrompts.decompose(query));

    let parsed: { shouldDecompose?: boolean; subQuestions?: string[] } | null =
      null;
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      }
    } catch {
      parsed = null;
    }

    if (parsed && Array.isArray(parsed.subQuestions)) {
      const subs = parsed.subQuestions
        .map((s) => String(s).trim())
        .filter((s) => s.length > 0 && s.length <= 100)
        .slice(0, 4);
      if (parsed.shouldDecompose === false) {
        return subs.length > 0 ? subs : [query];
      }
      return subs;
    }

    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\d\-\.\)、]\s*/, "").trim())
      .filter((l) => l.length > 4 && l.length <= 100)
      .slice(0, 4);
    return lines.length > 0 ? lines : [];
  } catch (err) {
    logger.error("[decomposeQuery] LLM 调用失败:", err);
    return [];
  }
}

/**
 * 完整查询增强: rewrite → expansion → step-back → decompose → hyde
 * 每条独立 LLM 调用,命中 LLM 缓存即免费
 */
export async function enhanceQuery(
  query: string,
  options?: {
    useExpansion?: boolean;
    useHyDE?: boolean;
    useStepBack?: boolean;
    useDecomposition?: boolean;
    disableAutoStepBack?: boolean;
    disableAutoDecomposition?: boolean;
    llmCaller?: (prompt: string) => Promise<string>;
  },
): Promise<{
  queries: string[];
  hypotheticalDoc?: string;
  isComplex: boolean;
  strategies: string[];
}> {
  const result: {
    queries: string[];
    hypotheticalDoc?: string;
    isComplex: boolean;
    strategies: string[];
  } = {
    queries: [query],
    isComplex: false,
    strategies: [],
  };

  // 1. 查询改写
  const rewritten = await rewriteQuery(query, options?.llmCaller);
  if (rewritten !== query) {
    result.queries.push(rewritten);
    result.strategies.push("rewrite");
  }

  // 2. 查询扩展
  if (options?.useExpansion !== false) {
    const expanded = expandQuery(query);
    for (const variation of expanded.variations) {
      if (!result.queries.includes(variation)) {
        result.queries.push(variation);
      }
    }
    if (expanded.variations.length > 1) {
      result.strategies.push("expansion");
    }
  }

  // 3-4. Step-back + Decomposition
  const isComplex = isComplexQuery(query);
  result.isComplex = isComplex;

  const useStepBack =
    options?.useStepBack ?? (isComplex && !options?.disableAutoStepBack);
  const useDecompose =
    options?.useDecomposition ??
    (isComplex && !options?.disableAutoDecomposition);

  if (useStepBack && options?.llmCaller) {
    try {
      const stepBack = await stepBackQuery(query, options.llmCaller);
      if (stepBack && !result.queries.includes(stepBack)) {
        result.queries.unshift(stepBack);
        result.strategies.push("stepBack");
      }
    } catch (err) {
      logger.error("[enhanceQuery] step-back 失败（已跳过）:", err);
    }
  }

  if (useDecompose && options?.llmCaller) {
    try {
      const subs = await decomposeQuery(query, options.llmCaller);
      for (const s of subs) {
        if (s && !result.queries.includes(s)) {
          result.queries.push(s);
        }
      }
      if (subs.length > 0) {
        result.strategies.push("decompose");
      }
    } catch (err) {
      logger.error("[enhanceQuery] decompose 失败（已跳过）:", err);
    }
  }

  // 5. HyDE
  if (options?.useHyDE && options?.llmCaller) {
    try {
      result.hypotheticalDoc = await generateHypotheticalAnswer(
        query,
        options.llmCaller,
      );
      result.strategies.push("hyde");
    } catch (error) {
      logger.error("HyDE 生成失败:", error);
    }
  }

  result.queries = result.queries.slice(0, 10);

  return result;
}
