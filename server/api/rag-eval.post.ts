import { promises as fs } from "fs";
import { join } from "path";
import { H3Event } from "h3";
import {
  evaluateRAG,
  type EvalTestCase,
  type EvalOptions,
  type EvalReport,
} from "../services/eval.service";
import { logger } from "../lib/logger";

/**
 * POST /api/rag-eval
 * Body 两种形式:
 *   1) { testCases: EvalTestCase[], options?: EvalOptions }   内联传测试集
 *   2) { casesFile: "rag-eval-cases.json", options?: EvalOptions }   读 data 下的文件
 */
export default defineEventHandler(
  async (event: H3Event): Promise<EvalReport> => {
    const body = await readBody<{
      testCases?: EvalTestCase[];
      casesFile?: string;
      options?: EvalOptions;
    }>(event);

    let testCases: EvalTestCase[] = body?.testCases ?? [];
    if (testCases.length === 0 && body?.casesFile) {
      const path = join(process.cwd(), "data", body.casesFile);
      const raw = await fs.readFile(path, "utf-8");
      const parsed = JSON.parse(raw);
      testCases = Array.isArray(parsed) ? parsed : (parsed.testCases ?? []);
    }

    if (!Array.isArray(testCases) || testCases.length === 0) {
      throw createError({
        statusCode: 400,
        message: "testCases 不能为空（可走 casesFile）",
      });
    }

    for (const tc of testCases) {
      if (!tc?.question || typeof tc.question !== "string") {
        throw createError({
          statusCode: 400,
          message: "每条 case 必须有字符串 question",
        });
      }
    }

    const report = await evaluateRAG(testCases, body?.options ?? {});
    logger.info(
      `[RAG-Eval] ${report.totalCases} cases  ` +
        `P=${report.metrics.contextPrecision.toFixed(3)}  ` +
        `R=${report.metrics.contextRecall.toFixed(3)}  ` +
        `F=${report.metrics.faithfulness.toFixed(3)}  ` +
        `AR=${report.metrics.answerRelevancy.toFixed(3)}`,
    );
    return report;
  },
);
