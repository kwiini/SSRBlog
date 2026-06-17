/**
 * 综述生成(Map-Reduce,支持分批聚合 + 事实核查)
 *
 * 流程:aggregateReview(summaries)
 *   Map:    每篇论文 → 结构化摘要(summarizeOnePaper,extractKeySections 控制预算)
 *   Reduce:
 *     - 摘要 ≤ BATCH_SIZE 篇 → 单次 reduceBatch
 *     - 摘要 > BATCH_SIZE 篇 → 分批 reduceBatch → mergeIntermediateReviews
 *   FactCheck: 用 LLM-as-judge 把综述里每条声明跟原始摘要对一遍,
 *              pass=原样,revise=可疑段落追加 [需核实],fail=整篇加警告
 */

import { callLLM } from "../core/llm/client";
import { extractKeySections } from "../processors/text-extractor";
import { ReviewPrompts } from "../core/prompts";
import { estimateTokens } from "../core/llm/tokens";

import { logger } from "../lib/logger";

export interface PaperInput {
  name: string;
  content: string;
}

export interface PaperSummary {
  title: string;
  summary: string;
  method: string;
  conclusion: string;
}

// 单篇论文 Map 阶段允许的最大字符数(约对应 12-18k tokens)
const PER_PAPER_MAX_CHARS = 14000;
const PROMPT_RESERVE = 800;
const BATCH_SIZE = 6;
const REDUCE_PROMPT_RESERVE_TOKENS = 2000;
const CONTEXT_WINDOW_TOKENS = 28000;

/**
 * 预处理:抽取关键章节,控制 token 预算
 */
export function preparePaperContent(content: string): string {
  if (!content) return "";
  const budget = PER_PAPER_MAX_CHARS - PROMPT_RESERVE;
  if (content.length <= budget) return content;
  return extractKeySections(content, budget);
}

/**
 * 解析 LLM 返回的 JSON(容错:剥离 markdown 代码块、提取首个 JSON 对象)
 */
export function parseJsonResponse<T = any>(response: string): T | null {
  const cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Map 阶段:单篇论文 → 结构化摘要
 */
export async function summarizeOnePaper(
  name: string,
  content: string,
): Promise<PaperSummary> {
  const prepared = preparePaperContent(content);

  const prompt = ReviewPrompts.map(name, prepared);

  const response = await callLLM(prompt);
  const parsed = parseJsonResponse<PaperSummary>(response);
  if (parsed && parsed.title) {
    return {
      title: String(parsed.title).slice(0, 200),
      summary: String(parsed.summary || "").slice(0, 600),
      method: String(parsed.method || "").slice(0, 400),
      conclusion: String(parsed.conclusion || "").slice(0, 400),
    };
  }
  return { title: name, summary: "", method: "", conclusion: "" };
}

function formatSummariesText(summaries: PaperSummary[]): string {
  return summaries
    .map(
      (s, i) =>
        `【文献${i + 1}】${s.title}\n· 摘要：${s.summary}\n· 方法：${s.method}\n· 结论：${s.conclusion}`,
    )
    .join("\n\n---\n\n");
}

/**
 * 单次 Reduce:一批摘要 → 综述
 * 使用 ReviewPrompts.reduce(已内置 [1..N] 引用约定)
 */
async function reduceBatch(
  summaries: PaperSummary[],
  batchLabel?: string,
): Promise<any> {
  const papersText = formatSummariesText(summaries);
  const batchInfo = batchLabel ? `\n（本批为 ${batchLabel}）` : "";

  const prompt = ReviewPrompts.reduce(summaries.length, papersText, batchInfo);

  const response = await callLLM(prompt);
  const parsed = parseJsonResponse<any>(response);
  if (!parsed) {
    throw new Error("AI 返回内容格式异常，请重试");
  }
  return parsed;
}

/**
 * 合并多次 Reduce 的中间结果 → 最终综述
 */
async function mergeIntermediateReviews(
  intermediates: any[],
  allSummaries: PaperSummary[],
): Promise<any> {
  const partsText = intermediates
    .map((r, i) => {
      const bg = r.background || "";
      const inn = r.innovation || "";
      const trend = r.trend || "";
      return `【第${i + 1}批综述】\n研究领域：${r.field || ""}\n研究背景：${bg}\n创新点分析：${inn}\n研究趋势：${trend}`;
    })
    .join("\n\n---\n\n");

  const prompt = ReviewPrompts.merge(
    intermediates.length,
    allSummaries.length,
    partsText,
  );

  const response = await callLLM(prompt);
  const parsed = parseJsonResponse<any>(response);
  if (!parsed) {
    const fallback = intermediates[0] || {};
    return ensureCoreContents(fallback, allSummaries);
  }
  return ensureCoreContents(parsed, allSummaries);
}

/**
 * 兜底:保证 coreContents 是数组且长度与文献数一致
 */
function ensureCoreContents(review: any, summaries: PaperSummary[]): any {
  if (!Array.isArray(review.coreContents)) {
    review.coreContents = [];
  }
  while (review.coreContents.length < summaries.length) {
    const idx = review.coreContents.length;
    review.coreContents.push({
      title: summaries[idx]?.title || `文献${idx + 1}`,
      summary: summaries[idx]?.summary || "",
      method: summaries[idx]?.method || "",
      conclusion: summaries[idx]?.conclusion || "",
    });
  }
  if (review.coreContents.length > summaries.length) {
    review.coreContents = review.coreContents.slice(0, summaries.length);
  }
  return review;
}

/**
 * 智能分批:根据 token 预算决定每批放几篇摘要
 */
function computeBatchSize(summaries: PaperSummary[]): number {
  const sampleText = formatSummariesText(
    summaries.slice(0, Math.min(3, summaries.length)),
  );
  const avgTokensPerPaper =
    estimateTokens(sampleText) / Math.min(3, summaries.length);
  const availableTokens = CONTEXT_WINDOW_TOKENS - REDUCE_PROMPT_RESERVE_TOKENS;

  if (avgTokensPerPaper <= 0) return BATCH_SIZE;
  const fitCount = Math.floor(availableTokens / avgTokensPerPaper);
  return Math.max(2, Math.min(fitCount, BATCH_SIZE));
}

/* ─── FactCheck 事实核查 ────────────────────────────── */

interface FactCheckIssue {
  field: string;
  severity: "unsupported" | "misattributed";
  quote: string;
  reason: string;
}

export interface FactCheckReport {
  verdict: "pass" | "revise" | "fail";
  score: number;
  issues: FactCheckIssue[];
}

/**
 * 事实核查:用 LLM-as-judge 把综述里每条声明跟原始摘要对一遍
 * 失败返回 null(不阻塞主流程)
 */
export async function factCheckReview(
  review: any,
  summaries: PaperSummary[],
): Promise<FactCheckReport | null> {
  if (!review || summaries.length === 0) return null;

  const reviewJson = JSON.stringify(review, null, 2);
  const papersText = formatSummariesText(summaries);

  const prompt = ReviewPrompts.factCheck(
    summaries.length,
    reviewJson,
    papersText,
  );
  const response = await callLLM(prompt);
  const parsed = parseJsonResponse<FactCheckReport>(response);
  if (!parsed || !parsed.verdict) return null;
  return {
    verdict: parsed.verdict,
    score: typeof parsed.score === "number" ? parsed.score : 0,
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
  };
}

function annotateReviewWithFactCheck(
  review: any,
  report: FactCheckReport,
): any {
  const annotated = { ...review };
  const issuesByField: Record<string, FactCheckIssue[]> = {};
  for (const issue of report.issues) {
    if (!issuesByField[issue.field]) issuesByField[issue.field] = [];
    (issuesByField[issue.field] ??= []).push(issue);
  }

  for (const field of ["background", "innovation", "trend"] as const) {
    const issues = issuesByField[field];
    if (issues && issues.length > 0 && typeof annotated[field] === "string") {
      annotated[field] =
        annotated[field] +
        `\n\n[需核实] 本段含 ${issues.length} 条未在原始文献中找到依据的声明`;
    }
  }

  if (Array.isArray(annotated.coreContents)) {
    annotated.coreContents = annotated.coreContents.map(
      (item: any, i: number) => {
        const next = { ...item };
        for (const subField of ["summary", "method", "conclusion"] as const) {
          const key = `coreContents[${i}].${subField}`;
          if (
            issuesByField[key] &&
            issuesByField[key]!.length > 0 &&
            typeof next[subField] === "string"
          ) {
            next[subField] = next[subField] + " [需核实]";
          }
        }
        return next;
      },
    );
  }

  annotated.factCheck = {
    verdict: report.verdict,
    score: report.score,
    issueCount: report.issues.length,
    fail: report.verdict === "fail",
  };

  return annotated;
}

/**
 * Reduce 入口:自动判断是否需要分批
 */
/* ─── Citations 引用解析 ────────────────────────────── */

export interface CitationRef {
  /** [N] 中的 N,从 1 开始 */
  index: number;
  /** 该引用出现的字段 */
  field: string;
  /** 该引用所在的句子(去掉 [N] 标记) */
  sentence: string;
  /** 引用的论文是否合法(1..N 范围内) */
  valid: boolean;
}

export interface CitationExtract {
  /** 所有引用,按出现顺序 */
  refs: CitationRef[];
  /** 引用统计 */
  stats: {
    /** 引用总次数(同一处出现 [1][2] 算 2) */
    total: number;
    /** 唯一引用到的论文编号 */
    unique: number;
    /** 引用了不存在的编号的次数(疑似 LLM 幻觉) */
    invalidCount: number;
  };
  /** 每篇论文被引用次数(1-indexed) */
  perPaper: number[];
}

const CITATION_RE = /\[(\d+)\]/g;

/**
 * 从综述文本里提取 [N] 引用,验证有效性
 * - 扫描 background / innovation / trend
 * - coreContents[i] 天然归属第 i+1 篇,不算 inline 引用
 */
export function extractCitations(
  review: any,
  paperCount: number,
): CitationExtract {
  const refs: CitationRef[] = [];
  const perPaper = new Array(Math.max(paperCount, 0)).fill(0);

  const fields = ["background", "innovation", "trend"] as const;
  for (const field of fields) {
    const text = review?.[field];
    if (typeof text !== "string" || !text) continue;

    // 按句号 / 问号 / 感叹号 / 换行 拆句
    const sentences = text.split(/(?<=[。！？!?\n])/);
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      // 找出本句里所有 [N]
      const matches = [...sentence.matchAll(CITATION_RE)];
      for (const m of matches) {
        const n = parseInt(m[1]!, 10);
        const valid = n >= 1 && n <= paperCount;
        refs.push({
          index: n,
          field,
          sentence: sentence.replace(CITATION_RE, "").trim(),
          valid,
        });
        if (valid) {
          perPaper[n - 1] = (perPaper[n - 1] || 0) + 1;
        }
      }
    }
  }

  const unique = new Set(refs.filter((r) => r.valid).map((r) => r.index)).size;
  const invalidCount = refs.filter((r) => !r.valid).length;

  return {
    refs,
    stats: { total: refs.length, unique, invalidCount },
    perPaper,
  };
}

/**
 * Reduce 入口：自动判断是否需要分批
 *
 * 完整主流程(每一步都是一等公民,可观测、可独立调用):
 *   Map → Reduce (分批) → [可选 Merge] → Citation 解析 → FactCheck
 *
 * 返回 { review, factCheck, citations } 三件套,调用方一次拿到全部产物
 */
export interface ReviewResult {
  review: any;
  /** 事实核查报告(可能为 null: LLM 失败时降级) */
  factCheck: FactCheckReport | null;
  /** 从综述中提取的 [N] 引用及解析结果 */
  citations: CitationExtract;
}

export async function aggregateReview(
  summaries: PaperSummary[],
): Promise<ReviewResult> {
  if (summaries.length === 0) {
    throw new Error("没有可聚合的文献摘要");
  }

  const batchSize = computeBatchSize(summaries);
  let raw: any;
  if (summaries.length <= batchSize) {
    raw = ensureCoreContents(await reduceBatch(summaries), summaries);
  } else {
    const batches: PaperSummary[][] = [];
    for (let i = 0; i < summaries.length; i += batchSize) {
      batches.push(summaries.slice(i, i + batchSize));
    }

    const intermediates: any[] = [];
    for (let i = 0; i < batches.length; i++) {
      const batchResult = await reduceBatch(
        batches[i]!,
        batches.length > 1
          ? `第${i + 1}批（共${batches.length}批）`
          : undefined,
      );
      intermediates.push(batchResult);
    }

    if (intermediates.length === 1) {
      raw = ensureCoreContents(intermediates[0], summaries);
    } else {
      raw = await mergeIntermediateReviews(intermediates, summaries);
    }
  }

  // Citation 解析(无 LLM 调用,纯文本解析,始终成功)
  const citations = extractCitations(raw, summaries.length);

  // FactCheck(可能为 null: LLM 失败时降级返回原始 raw)
  const factCheck = await runFactCheckSafe(raw, summaries);

  // 在 review 上标注 [需核实],把完整 factCheck 报告单独返回给调用方
  const review = factCheck ? annotateReviewWithFactCheck(raw, factCheck) : raw;

  return { review, factCheck, citations };
}

/**
 * 事实核查包装层(导出为独立函数,便于测试和复用)
 * 失败不阻塞主流程,只 logger.error
 */
export async function runFactCheckSafe(
  review: any,
  summaries: PaperSummary[],
): Promise<FactCheckReport | null> {
  try {
    const report = await factCheckReview(review, summaries);
    return report;
  } catch (err) {
    logger.error("[review-generator] fact-check failed (non-fatal):", err);
    return null;
  }
}
