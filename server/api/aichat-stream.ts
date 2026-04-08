import { H3Event } from "h3";

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export default defineEventHandler(async (event: H3Event) => {
  const { message, history = [] } = await readBody(event);

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

  // 构建消息列表：系统提示 + 历史消息 + 当前用户消息
  const messages: LLMMessage[] = [
    {
      role: "system",
      content: "你是一个有帮助的AI助手，请用中文回答问题。",
    },
    ...history,
    {
      role: "user",
      content: message,
    },
  ];

  // 设置 SSE 响应头
  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");

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

                // 流结束标记
                if (data === "[DONE]") {
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || "";

                  if (content) {
                    // 直接发送文本内容
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Stream error",
    });
  }
});
