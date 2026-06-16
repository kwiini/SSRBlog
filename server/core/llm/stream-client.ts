/**
 * LLM 流式客户端(自动接限流 + 响应缓存)
 *
 *  - 缓存键:md5(model + 全部 messages),与 callLLM() 共享同一份 LLM 缓存
 *  - 缓存命中:按 replayChunkSize 切块回放,模拟正常 token 流节奏
 *  - 缓存未命中:真流式 upstream,流结束后写缓存
 *  - 限流槽位申请失败 → 抛 503(由 callLLM 同样的 acquireLLMSlot() 行为)
 *  - ReadableStream cancel() 时立刻释放槽位,不被浏览器断连拖住
 *
 * 缓存复用:server/core/llm/cache.ts 的 getFromLLMCache/saveToLLMCache
 * 限流复用:server/core/llm/rate-limiter.ts 的 acquireLLMSlot
 */

import { createHash } from "crypto";
import { acquireLLMSlot } from "./rate-limiter";
import { getFromLLMCache, saveToLLMCache } from "./cache";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamLLMOptions {
  messages: LLMMessage[];
  /** 强制不走缓存(用于"重新生成"等场景) */
  bypassCache?: boolean;
  /** 命中缓存时是否仍按流式分块发出(默认 true, 模拟逐 token) */
  replayAsStream?: boolean;
  /** 命中缓存时分块大小,字符数(默认 16) */
  replayChunkSize?: number;
}

export interface StreamLLMHandle {
  /** 直接 return 给 nitro 即可 */
  stream: ReadableStream<Uint8Array>;
  /** 本次调用是否命中缓存 */
  cacheHit: boolean;
  /** 主动取消(浏览器断连时由框架触发 cancel(),无需手动调) */
  cancel: () => void;
}

interface UpstreamConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

function readConfig(): UpstreamConfig {
  const config = useRuntimeConfig();
  return {
    apiKey: config.llmApiKey,
    baseURL:
      config.llmBaseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: config.llmModel || "qwen-max",
  };
}

export function hashMessages(model: string, messages: LLMMessage[]): string {
  const h = createHash("md5").update(model);
  for (const m of messages) {
    h.update("\0").update(m.role).update("\0").update(m.content);
  }
  return h.digest("hex");
}

/**
 * 流式 LLM 调用
 */
export async function streamLLM(opts: StreamLLMOptions): Promise<StreamLLMHandle> {
  const cfg = readConfig();
  if (!cfg.apiKey) {
    throw createError({ statusCode: 500, message: "LLM API Key 未配置" });
  }

  const cacheKey = hashMessages(cfg.model, opts.messages);

  // 1) 缓存命中 → 切块回放
  if (!opts.bypassCache) {
    const cached = getFromLLMCache(cacheKey);
    if (cached !== null) {
      return makeReplayStream(cached, opts.replayChunkSize ?? 16);
    }
  }

  // 2) 缓存未命中 → 拿限流槽位 → 真流式 upstream
  const release = await acquireLLMSlot().catch((err) => {
    throw createError({ statusCode: 503, message: err.message });
  });

  return createUpstreamStream(cfg, opts.messages, cacheKey, release);
}

/** 缓存命中:把完整文本切块,以 ReadableStream 形式发出 */
function makeReplayStream(cached: string, chunkSize: number): StreamLLMHandle {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        for (let i = 0; i < cached.length; i += chunkSize) {
          controller.enqueue(encoder.encode(cached.slice(i, i + chunkSize)));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  return {
    stream,
    cacheHit: true,
    cancel: () => stream.cancel(),
  };
}

/** 缓存未命中:fetch upstream,解析 SSE delta,流结束后写缓存 */
function createUpstreamStream(
  cfg: UpstreamConfig,
  messages: LLMMessage[],
  cacheKey: string,
  release: () => void,
): StreamLLMHandle {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let full = "";
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let upstreamCancelled = false;
  let upstreamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      upstreamController = controller;
      let response: Response;
      try {
        response = await fetch(`${cfg.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            messages,
            stream: true,
          }),
        });
      } catch (err: any) {
        release();
        controller.error(err);
        return;
      }

      if (!response.ok) {
        release();
        const text = await response.text();
        controller.error(new Error(`LLM API error: ${response.status} - ${text}`));
        return;
      }

      const reader = response.body!.getReader();
      upstreamReader = reader;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") {
              controller.close();
              break;
            }
            try {
              const parsed = JSON.parse(data);
              const content: string = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                full += content;
                controller.enqueue(encoder.encode(content));
              }
            } catch {
              // 忽略单行 JSON 解析错误,继续下一行
            }
          }
        }
        if (!upstreamCancelled) controller.close();
        // 流完整结束,写缓存
        if (full) saveToLLMCache(cacheKey, full);
      } catch (err) {
        controller.error(err);
      } finally {
        try { reader.releaseLock(); } catch { /* already released */ }
        release();
      }
    },
    cancel() {
      upstreamCancelled = true;
      // 浏览器断连 / 客户端 abort:立刻释放槽位,不被卡到下一次 done
      release();
    },
  });

  return {
    stream,
    cacheHit: false,
    cancel: () => {
      upstreamCancelled = true;
      stream.cancel();
    },
  };
}
