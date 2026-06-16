import { H3Event } from "h3";
import { ragQuery, RAGQueryOptions } from "../../services/rag.service";
import { SystemPrompts } from "../../core/prompts";
import { callLLM } from "../../core/llm/client";
import { streamLLM, type LLMMessage } from "../../core/llm/stream-client";
import { compressHistory } from "../../processors/history-compressor";

import { logger } from "../../lib/logger";

/**
 * POST /api/chat/rag-chat
 * RAG 流式对话(检索 + LLM 生成,带来源标注)
 */
export default defineEventHandler(async (event: H3Event) => {
  const {
    message,
    history = [],
    useRAG = true,
    ragOptions = {},
  } = (await readBody(event)) as {
    message: string;
    history: LLMMessage[];
    useRAG: boolean;
    ragOptions?: RAGQueryOptions;
  };

  if (!message || typeof message !== "string") {
    throw createError({
      statusCode: 400,
      message: "Message is required and must be a string",
    });
  }

  let userContent = message;
  let retrievedContext: any[] = [];

  if (useRAG) {
    try {
      const ragResult = await ragQuery(message, {
        topK: ragOptions.topK || 3,
        useMultiQuery: ragOptions.useMultiQuery || false,
        useCompression: ragOptions.useCompression !== false,
        maxContextLength: ragOptions.maxContextLength || 600,
        useHyDE: ragOptions.useHyDE !== false,
        useStepBack: ragOptions.useStepBack,
        useDecomposition: ragOptions.useDecomposition,
      });
      userContent = ragResult.prompt;
      retrievedContext = ragResult.context;

      logger.info(`[RAG] 查询: "${message.substring(0, 50)}..."`);
      logger.info(`[RAG] 关键词: ${ragResult.keywords.join(", ")}`);
      logger.info(`[RAG] 检索到 ${ragResult.context.length} 条上下文`);

      if (ragResult.context.length > 0) {
        const avgScore =
          retrievedContext.reduce(
            (sum, c) => sum + (c.hybridScore || c.similarity),
            0,
          ) / retrievedContext.length;
        logger.info(`[RAG] 平均相关度: ${(avgScore * 100).toFixed(1)}%`);
      }
    } catch (error) {
      logger.error("RAG 检索失败:", error);
    }
  }

  const compressedHistory = await compressHistory(history, {
    maxMessages: 8,
    maxTokens: 1500,
    llmCaller: callLLM,
  });

  const messages: LLMMessage[] = [
    { role: "system", content: SystemPrompts.rag },
    ...compressedHistory.messages,
    { role: "user", content: userContent },
  ];

  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");

  if (retrievedContext.length > 0) {
    const sources = JSON.stringify(
      retrievedContext.map((c) => ({
        title: c.metadata.title,
        path: c.metadata.path,
        score: Math.round((c.hybridScore || c.similarity) * 100),
      })),
    );
    setResponseHeader(event, "X-Context-Sources", encodeURIComponent(sources));
  }

  const { stream } = await streamLLM({ messages });
  return stream;
});
