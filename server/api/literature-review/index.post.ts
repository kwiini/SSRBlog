/**
 * POST /api/literature-review
 * Map-Reduce 综述生成入口（不落库，仅生成）
 */
import {
  aggregateReview,
  summarizeOnePaper,
  type PaperInput,
} from "../../services/review.service";

// Map 阶段最大并发数（避免同时打 10+ 个 LLM 请求触发限流）
const MAP_CONCURRENCY = 3;

/**
 * 限流并发执行：最多同时跑 limit 个任务
 */
async function mapConcurrent<T>(
  items: T[],
  fn: (item: T) => Promise<any>,
  limit: number
): Promise<any[]> {
  const results: any[] = [];
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export default defineEventHandler(async (event) => {
  try {
    const { papers } = await readBody(event);

    if (!Array.isArray(papers) || papers.length === 0) {
      throw createError({
        statusCode: 400,
        message: "请至少上传一篇文献",
      });
    }

    const validPapers: PaperInput[] = papers.filter(
      (p: PaperInput) =>
        p && typeof p.content === "string" && p.content.trim().length > 0
    );
    if (validPapers.length === 0) {
      throw createError({
        statusCode: 400,
        message: "文献内容为空",
      });
    }

    // Map：限流并发处理每篇文献，提取结构化摘要
    const summaries = await mapConcurrent(
      validPapers,
      (p) => summarizeOnePaper(p.name, p.content),
      MAP_CONCURRENCY
    );

    // Reduce：聚合所有摘要生成最终综述（内部自动分批）
    // 返回 { review, factCheck, citations } 三件套——主流程一等公民
    const { review, factCheck, citations } = await aggregateReview(summaries);

    // 兜底：保证 coreContents 是数组且长度与文献数一致
    if (!Array.isArray(review.coreContents)) {
      review.coreContents = [];
    }
    while (review.coreContents.length < validPapers.length) {
      const idx = review.coreContents.length;
      review.coreContents.push({
        title: summaries[idx]?.title || validPapers[idx]?.name || "未命名文献",
        summary: summaries[idx]?.summary || "",
        method: summaries[idx]?.method || "",
        conclusion: summaries[idx]?.conclusion || "",
      });
    }

    return {
      success: true,
      data: review,
      factCheck,         // 完整事实核查报告(含 issues[]),null 表示降级
      citations,         // 引用解析结果(含 [N] 标记提取 + 合法性验证)
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || "生成综述失败",
    });
  }
});
