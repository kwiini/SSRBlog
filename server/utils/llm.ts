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

/**
 * 粗略估算中文文本的 token 数
 * 规则：1 中文字 ≈ 1.5 token，1 英文词 ≈ 1.3 token，标点/数字 ≈ 0.5 token
 * 仅供分批决策使用，不需要精确
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x4e00 && code <= 0x9fff) {
      tokens += 1.5; // CJK 统一汉字
    } else if (/[a-zA-Z]/.test(ch)) {
      tokens += 0.25; // 英文字母（4 字母 ≈ 1 token）
    } else if (/\d/.test(ch)) {
      tokens += 0.5;
    } else {
      tokens += 0.5; // 标点、空格等
    }
  }
  return Math.ceil(tokens);
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

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: "你是一个有帮助的AI助手，请用中文回答问题。",
    },
    {
      role: "user",
      content: message,
    },
  ];

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
    return data.choices[0]?.message?.content || "无响应内容";
  } catch (error) {
    console.error("LLM call failed:", error);
    throw error;
  }
}
