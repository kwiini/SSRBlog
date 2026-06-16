import { H3Event } from "h3";
import { SystemPrompts } from "../../core/prompts";
import { callLLM } from "../../core/llm/client";
import { streamLLM, type LLMMessage } from "../../core/llm/stream-client";
import { compressHistory } from "../../processors/history-compressor";

/**
 * GET /api/chat/aichat-stream
 * Server-Sent Events 流式对话(支持 history 压缩)
 */
export default defineEventHandler(async (event: H3Event) => {
  const { message, history = [] } = await readBody(event);

  if (!message || typeof message !== "string") {
    throw createError({
      statusCode: 400,
      message: "Message is required and must be a string",
    });
  }

  // 长对话压缩:超阈值才调 LLM,重复 session 0 调用(LLM 缓存命中)
  const compressedHistory = await compressHistory(history, {
    maxMessages: 8,
    maxTokens: 1500,
    llmCaller: callLLM,
  });

  const messages: LLMMessage[] = [
    { role: "system", content: SystemPrompts.assistant },
    ...compressedHistory.messages,
    { role: "user", content: message },
  ];

  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");

  const { stream } = await streamLLM({ messages });
  return stream;
});
