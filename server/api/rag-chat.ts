import { H3Event } from "h3";
import { ragQuery, RAGQueryOptions } from "../utils/rag";

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export default defineEventHandler(async (event: H3Event) => {
  const { 
    message, 
    history = [], 
    useRAG = true,
    ragOptions = {} 
  } = await readBody(event) as {
    message: string;
    history: LLMMessage[];
    useRAG: boolean;
    ragOptions?: RAGQueryOptions;
  };

  if (!message || typeof message !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Message is required and must be a string",
    });
  }

  const config = useRuntimeConfig();
  const apiKey = config.llmApiKey;
  const baseURL =
    config.llmBaseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = config.llmModel || "qwen-max";

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "LLM API Key 未配置",
    });
  }

  let userContent = message;
  let retrievedContext: any[] = [];

  // 如果启用 RAG，检索相关内容并构建 Prompt
  if (useRAG) {
    try {
      const ragResult = await ragQuery(message, {
        topK: ragOptions.topK || 3,
        useMultiQuery: ragOptions.useMultiQuery || false,
        useCompression: ragOptions.useCompression !== false,  // 默认启用
        maxContextLength: ragOptions.maxContextLength || 600
      });
      userContent = ragResult.prompt;
      retrievedContext = ragResult.context;
      
      // 日志记录
      console.log(`[RAG] 查询: "${message.substring(0, 50)}..."`);
      console.log(`[RAG] 关键词: ${ragResult.keywords.join(', ')}`);
      console.log(`[RAG] 检索到 ${ragResult.context.length} 条上下文`);
      
      // 记录检索性能
      if (ragResult.context.length > 0) {
        const avgScore = ragResult.context.reduce((sum, c) => sum + (c.hybridScore || c.similarity), 0) / ragResult.context.length;
        console.log(`[RAG] 平均相关度: ${(avgScore * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.error("RAG 检索失败:", error);
      // 检索失败时仍使用原始问题
    }
  }

  // 构建消息列表
  const messages: LLMMessage[] = [
    {
      role: "system",
      content:
        "你是一个有帮助的AI助手。当提供参考资料时，请基于这些资料回答问题；如果没有相关资料，请直接回答用户问题。",
    },
    ...history,
    {
      role: "user",
      content: userContent,
    },
  ];

  // 设置 SSE 响应头
  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");

  // 如果有检索结果，通过自定义响应头返回来源信息
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

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法获取响应流");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // 返回流
    return new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);

                if (data === "[DONE]") {
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || "";

                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "请求失败",
    });
  }
});
