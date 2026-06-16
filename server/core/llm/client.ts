/**
 * LLM 客户端(非流式)
 *  - 拼装消息
 *  - 命中响应缓存直接返回
 *  - 调用前先拿限流槽位,失败不堆积
 *  - 缓存键: model + system + user 的 md5
 *    model 切换/系统提示变更时调 clearLLMCache() 强制失效
 */

import { createHash } from "crypto";
import { SystemPrompts } from "../prompts";
import { acquireLLMSlot } from "./rate-limiter";
import { getFromLLMCache, saveToLLMCache } from "./cache";

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function callLLM(message: string): Promise<string> {
  const config = useRuntimeConfig();

  const apiKey = config.llmApiKey;
  const baseURL =
    config.llmBaseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = config.llmModel || "qwen-max";

  if (!apiKey) {
    throw new Error("LLM API Key 未配置");
  }

  const cacheKey = createHash("md5")
    .update(model)
    .update("\0")
    .update(SystemPrompts.assistant)
    .update("\0")
    .update(message)
    .digest("hex");

  // 1. 查缓存
  const cached = getFromLLMCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: SystemPrompts.assistant,
    },
    {
      role: "user",
      content: message,
    },
  ];

  // 拿 LLM 调用槽位,限流防打爆上游 QPM/TPM
  const release = await acquireLLMSlot();
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
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data: LLMResponse = await response.json();
    const content = data.choices[0]?.message?.content || "无响应内容";

    // 2. 写缓存
    saveToLLMCache(cacheKey, content);

    return content;
  } catch (error) {
    console.error("LLM call failed:", error);
    throw error;
  } finally {
    release();
  }
}
