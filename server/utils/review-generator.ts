/**
 * 综述生成共享工具（Map-Reduce 流程，支持分批聚合）
 * 被 index.post.ts（生成）调用，也可被定时任务/后台 Worker 复用
 *
 * 流程：
 *   Map：每篇论文 → 结构化摘要（并发，每篇独立控制在 token 预算内）
 *   Reduce：
 *     - 摘要 ≤ BATCH_SIZE 篇 → 单次聚合
 *     - 摘要 > BATCH_SIZE 篇 → 分批聚合 → 中间综述 → 最终合并
 */
import { callLLM, estimateTokens } from "./llm";
import { extractKeySections } from "./text-extractor";

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

// ─── 常量 ───────────────────────────────────────────────
// 单篇论文 Map 阶段允许的最大字符数（约对应 12-18k tokens）
const PER_PAPER_MAX_CHARS = 14000;
// 单篇论文 Map 提示词中保留给指令的预算
const PROMPT_RESERVE = 800;
// Reduce 阶段每批最大论文数（超过则分批）
const BATCH_SIZE = 6;
// Reduce prompt 中留给指令 + 输出格式的 token 预算
const REDUCE_PROMPT_RESERVE_TOKENS = 2000;
// LLM 上下文窗口 token 上限（Qwen 32k，留 4k 给输出）
const CONTEXT_WINDOW_TOKENS = 28000;

/**
 * 预处理：抽取关键章节，控制 token 预算
 */
export function preparePaperContent(content: string): string {
  if (!content) return "";
  const budget = PER_PAPER_MAX_CHARS - PROMPT_RESERVE;
  if (content.length <= budget) return content;
  return extractKeySections(content, budget);
}

/**
 * 解析 LLM 返回的 JSON（容错：剥离 markdown 代码块、提取首个 JSON 对象）
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
 * Map 阶段：单篇论文 → 结构化摘要
 */
export async function summarizeOnePaper(
  name: string,
  content: string
): Promise<PaperSummary> {
  const prepared = preparePaperContent(content);

  const prompt = `你是一位学术文献分析专家。请仔细阅读以下文献内容，提取关键信息用于后续综述。

# 文献名称
${name}

# 文献内容
${prepared || "（无内容）"}

# 输出要求
请严格输出以下 JSON 格式（不要包含 markdown 代码块标记，不要添加任何其他文字）：
{
  "title": "文献标题（如能识别则填文献名，否则填原文件名）",
  "summary": "该文献的核心观点、研究目的与主要内容的精炼摘要，150-250字",
  "method": "该文献采用的主要研究方法、技术路线或实验手段，50-150字",
  "conclusion": "该文献的主要结论、关键发现或核心贡献，50-150字"
}

要求：
1. 必须输出合法 JSON，所有字段值使用中文
2. 若文献内容信息不足，对应字段可填空字符串
3. 不要输出 JSON 之外的任何内容`;

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
  // 兜底：解析失败时返回空结构，前端仍可显示文件名
  return { title: name, summary: "", method: "", conclusion: "" };
}

// ─── Reduce 阶段 ────────────────────────────────────────

/**
 * 将摘要列表格式化为 Reduce prompt 中的文献信息文本
 */
function formatSummariesText(summaries: PaperSummary[]): string {
  return summaries
    .map(
      (s, i) =>
        `【文献${i + 1}】${s.title}\n· 摘要：${s.summary}\n· 方法：${s.method}\n· 结论：${s.conclusion}`
    )
    .join("\n\n---\n\n");
}

/**
 * 单次 Reduce：一批摘要 → 综述
 */
async function reduceBatch(
  summaries: PaperSummary[],
  batchLabel?: string
): Promise<any> {
  const papersText = formatSummariesText(summaries);
  const batchInfo = batchLabel ? `\n（本批为 ${batchLabel}）` : "";

  const prompt = `你是一位学术文献综述专家。以下是 ${summaries.length} 篇文献的预提取信息，请在此基础上生成结构化文献综述。${batchInfo}

# 各篇文献核心信息
${papersText}

# 输出要求
请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记，不要添加任何其他文字）：

{
  "field": "这些文献所属的研究领域名称（一句话概括）",
  "background": "研究背景与意义：综合这些文献共同关注的研究背景、问题来源、以及该研究的重要性。200-400字。",
  "coreContents": [
    {
      "title": "对应文献的标题",
      "summary": "该文献的核心观点与主要内容摘要，100-200字",
      "method": "该文献采用的主要研究方法",
      "conclusion": "该文献的主要结论或发现"
    }
  ],
  "innovation": "创新点与对比分析：对比各篇文献的创新之处，分析它们之间的异同、互补关系或争议点。200-400字。",
  "trend": "研究趋势与展望：基于这些文献，分析该领域的研究趋势、尚未解决的问题、以及未来可能的研究方向。200-400字。"
}

要求：
1. coreContents 数组长度应与文献数量一致，按文献顺序排列
2. 直接复用各篇预提取的 summary/method/conclusion，必要时润色
3. 所有内容使用中文撰写
4. 严格输出纯 JSON`;

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
  allSummaries: PaperSummary[]
): Promise<any> {
  const partsText = intermediates
    .map((r, i) => {
      const bg = r.background || "";
      const inn = r.innovation || "";
      const trend = r.trend || "";
      return `【第${i + 1}批综述】\n研究领域：${r.field || ""}\n研究背景：${bg}\n创新点分析：${inn}\n研究趋势：${trend}`;
    })
    .join("\n\n---\n\n");

  const prompt = `你是一位学术文献综述专家。以下是对 ${allSummaries.length} 篇文献分 ${intermediates.length} 批生成的中间综述，请将它们合并为一份完整、连贯的最终综述。

# 各批综述内容
${partsText}

# 输出要求
请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记，不要添加任何其他文字）：

{
  "field": "所有文献所属的研究领域名称（一句话概括）",
  "background": "综合所有批次的背景信息，撰写统一的研究背景与意义。300-600字。",
  "coreContents": [
    {
      "title": "对应文献的标题",
      "summary": "该文献的核心观点与主要内容摘要，100-200字",
      "method": "该文献采用的主要研究方法",
      "conclusion": "该文献的主要结论或发现"
    }
  ],
  "innovation": "综合所有批次的创新点分析，进行跨批次的对比与综合。300-600字。",
  "trend": "综合所有批次的研究趋势，撰写统一的研究展望。300-600字。"
}

要求：
1. coreContents 数组长度必须为 ${allSummaries.length}，按文献顺序排列
2. 背景和创新点分析需要跨批次综合，不要简单拼接
3. 所有内容使用中文撰写
4. 严格输出纯 JSON`;

  const response = await callLLM(prompt);
  const parsed = parseJsonResponse<any>(response);
  if (!parsed) {
    // 合并失败时，直接使用第一批的结果 + 补齐 coreContents
    const fallback = intermediates[0] || {};
    return ensureCoreContents(fallback, allSummaries);
  }
  return ensureCoreContents(parsed, allSummaries);
}

/**
 * 兜底：保证 coreContents 是数组且长度与文献数一致
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
  // 截断多余的
  if (review.coreContents.length > summaries.length) {
    review.coreContents = review.coreContents.slice(0, summaries.length);
  }
  return review;
}

/**
 * 智能分批：根据 token 预算决定每批放几篇摘要
 */
function computeBatchSize(summaries: PaperSummary[]): number {
  // 估算单篇摘要的 token 数
  const sampleText = formatSummariesText(summaries.slice(0, Math.min(3, summaries.length)));
  const avgTokensPerPaper = estimateTokens(sampleText) / Math.min(3, summaries.length);
  const availableTokens = CONTEXT_WINDOW_TOKENS - REDUCE_PROMPT_RESERVE_TOKENS;

  if (avgTokensPerPaper <= 0) return BATCH_SIZE;
  const fitCount = Math.floor(availableTokens / avgTokensPerPaper);
  // 取计算值和硬上限的较小值，至少 2 篇一批
  return Math.max(2, Math.min(fitCount, BATCH_SIZE));
}

/**
 * Reduce 入口：自动判断是否需要分批
 */
export async function aggregateReview(summaries: PaperSummary[]): Promise<any> {
  if (summaries.length === 0) {
    throw new Error("没有可聚合的文献摘要");
  }

  // 少量文献：直接单次 Reduce
  const batchSize = computeBatchSize(summaries);
  if (summaries.length <= batchSize) {
    const result = await reduceBatch(summaries);
    return ensureCoreContents(result, summaries);
  }

  // 大量文献：分批 Reduce → 合并
  const batches: PaperSummary[][] = [];
  for (let i = 0; i < summaries.length; i += batchSize) {
    batches.push(summaries.slice(i, i + batchSize));
  }

  // 串行处理每批（避免并发冲击 LLM API 限流）
  const intermediates: any[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batchResult = await reduceBatch(
      batches[i]!,
      batches.length > 1 ? `第${i + 1}批（共${batches.length}批）` : undefined
    );
    intermediates.push(batchResult);
  }

  // 只有一批（理论上不会走到这里，但防御性处理）
  if (intermediates.length === 1) {
    return ensureCoreContents(intermediates[0], summaries);
  }

  // 多批合并
  return mergeIntermediateReviews(intermediates, summaries);
}
