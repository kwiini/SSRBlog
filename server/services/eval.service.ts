/**
 * RAG 质量评估(RAGAS 风格,LLM-as-judge)
 *
 * 四项指标:
 *   1. Context Precision  检索上下文中相关条目的比例
 *   2. Context Recall     真实答案所需信息被检索到的比例(需 groundTruth)
 *   3. Faithfulness       答案中的声明是否能被上下文支撑(反幻觉)
 *   4. Answer Relevancy   答案是否切题
 *
 * 用法: const report = await evaluateRAG(testCases)
 * 返回每题明细 + 平均分。
 */

import { ragQuery, type RAGQueryOptions } from "./rag.service";
import { callLLM } from "../core/llm/client";
import { EvalPrompts } from "../core/prompts";

import { logger } from "../lib/logger";

export interface EvalTestCase {
  question: string;
  groundTruth?: string;
  expectedSources?: string[];
}

export interface CaseScores {
  contextPrecision: number;
  contextRecall: number;
  faithfulness: number;
  answerRelevancy: number;
}

export interface EvalCaseResult {
  question: string;
  context: { source: string; title: string; content: string; score: number }[];
  answer: string;
  scores: CaseScores;
  notes?: string;
}

export interface EvalReport {
  totalCases: number;
  metrics: {
    contextPrecision: number;
    contextRecall: number;
    faithfulness: number;
    answerRelevancy: number;
  };
  perCase: EvalCaseResult[];
  generatedAt: string;
}

export interface EvalOptions extends Partial<RAGQueryOptions> {
  llmCaller?: (prompt: string) => Promise<string>;
}

type LLMCaller = (prompt: string) => Promise<string>;

async function judgeJSON<T>(
  caller: LLMCaller,
  prompt: string,
  fallback: T,
): Promise<T> {
  try {
    const text = await caller(prompt);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    return JSON.parse(match[0]) as T;
  } catch (err) {
    logger.error("[RAG-Eval] judge 解析失败:", err);
    return fallback;
  }
}

async function scoreContextPrecision(
  question: string,
  contexts: { content: string; title: string }[],
  caller: LLMCaller,
): Promise<number> {
  if (contexts.length === 0) return 0;

  const list = contexts
    .map(
      (c, i) => `[${i + 1}] 标题:${c.title}\n内容:${c.content.slice(0, 300)}`,
    )
    .join("\n\n");

  const prompt = EvalPrompts.contextPrecision(question, list);

  const result = await judgeJSON<{ relevance: number[] }>(caller, prompt, {
    relevance: [],
  });
  if (!Array.isArray(result.relevance) || result.relevance.length === 0) {
    return 0;
  }
  const sum = result.relevance.reduce((a, b) => a + (b ? 1 : 0), 0);
  return sum / result.relevance.length;
}

async function scoreContextRecall(
  question: string,
  groundTruth: string,
  contexts: { content: string; title: string }[],
  caller: LLMCaller,
): Promise<number> {
  const list = contexts
    .map(
      (c, i) => `[${i + 1}] 标题:${c.title}\n内容:${c.content.slice(0, 300)}`,
    )
    .join("\n\n");

  const prompt = EvalPrompts.contextRecall(question, groundTruth, list);

  const result = await judgeJSON<{ recall: number }>(caller, prompt, {
    recall: 0,
  });
  const v = Number(result.recall);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

async function scoreFaithfulness(
  question: string,
  answer: string,
  contexts: { content: string; title: string }[],
  caller: LLMCaller,
): Promise<number> {
  const ctxText = contexts
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.content.slice(0, 400)}`)
    .join("\n\n");

  const prompt = EvalPrompts.faithfulness(question, ctxText, answer);

  const result = await judgeJSON<{
    claims: { supported: boolean }[];
    score: number;
  }>(caller, prompt, { claims: [], score: 0 });
  if (Array.isArray(result.claims) && result.claims.length > 0) {
    const supported = result.claims.filter((c) => c.supported).length;
    return supported / result.claims.length;
  }
  const v = Number(result.score);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

async function scoreAnswerRelevancy(
  question: string,
  answer: string,
  caller: LLMCaller,
): Promise<number> {
  const prompt = EvalPrompts.answerRelevancy(question, answer);

  const result = await judgeJSON<{ relevance: number }>(caller, prompt, {
    relevance: 0,
  });
  const v = Number(result.relevance);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

async function generateAnswer(
  prompt: string,
  caller: LLMCaller,
): Promise<string> {
  try {
    return await caller(prompt);
  } catch (err) {
    logger.error("[RAG-Eval] 生成答案失败:", err);
    return "";
  }
}

/**
 * 跑 RAG 评估
 */
export async function evaluateRAG(
  testCases: EvalTestCase[],
  options: EvalOptions = {},
): Promise<EvalReport> {
  const caller = options.llmCaller ?? callLLM;
  const perCase: EvalCaseResult[] = [];

  for (const tc of testCases) {
    const ragResult = await ragQuery(tc.question, {
      topK: options.topK,
      useHyDE: options.useHyDE,
      useMultiQuery: options.useMultiQuery,
      useCompression: options.useCompression,
      maxContextLength: options.maxContextLength,
      llmCaller: caller,
    });

    const answer = await generateAnswer(ragResult.prompt, caller);

    const ctxItems = ragResult.context.map((c) => ({
      source: c.source,
      title: c.metadata.title,
      content: c.content,
      score: c.hybridScore ?? c.similarity,
    }));

    const [contextPrecision, faithfulness, answerRelevancy] = await Promise.all(
      [
        scoreContextPrecision(tc.question, ctxItems, caller),
        scoreFaithfulness(tc.question, answer, ctxItems, caller),
        scoreAnswerRelevancy(tc.question, answer, caller),
      ],
    );

    const contextRecall = tc.groundTruth
      ? await scoreContextRecall(tc.question, tc.groundTruth, ctxItems, caller)
      : NaN;

    perCase.push({
      question: tc.question,
      context: ctxItems,
      answer,
      scores: {
        contextPrecision,
        contextRecall,
        faithfulness,
        answerRelevancy,
      },
    });
  }

  const avg = (vals: number[]) =>
    vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;

  const recallValues = perCase
    .map((c) => c.scores.contextRecall)
    .filter((v) => !Number.isNaN(v));

  return {
    totalCases: testCases.length,
    metrics: {
      contextPrecision: avg(perCase.map((c) => c.scores.contextPrecision)),
      contextRecall: avg(recallValues),
      faithfulness: avg(perCase.map((c) => c.scores.faithfulness)),
      answerRelevancy: avg(perCase.map((c) => c.scores.answerRelevancy)),
    },
    perCase,
    generatedAt: new Date().toISOString(),
  };
}
