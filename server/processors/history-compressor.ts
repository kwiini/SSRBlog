/**
 * 对话历史压缩
 *
 * 解决:长对话 history 全量传给 LLM 导致 token 爆掉
 *
 * 策略:
 *   1. 在阈值内(消息数 + token 数都未超)→ 原样返回
 *   2. 超阈值 → 滑动窗口保留最近 N 条
 *   3. 老的轮次用 LLM 压缩为一段"前情提要",作为 system 消息插在 system 与最近历史之间
 *   4. LLM 失败 → 降级纯滑动窗口,不阻塞主对话
 */

import { estimateTokens } from "../core/llm/tokens"
import { HistoryPrompts } from "../core/prompts"

import { logger } from "../lib/logger";

export interface HistoryMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface CompressHistoryOptions {
  /** 保留最近多少条消息(一问一答算 2 条),默认 8 */
  maxMessages?: number
  /** 粗算 token 上限,默认 1500 */
  maxTokens?: number
  /** LLM 调用器;不传则退化为纯滑动窗口 */
  llmCaller?: (prompt: string) => Promise<string>
}

export interface CompressResult {
  messages: HistoryMessage[]
  /** 老 history 压缩后的摘要(仅在 LLM 压缩时存在) */
  summary?: string
  /** 是否发生了压缩 */
  compressed: boolean
  /** 压缩前 token 估算 */
  originalTokens: number
  /** 压缩后 token 估算 */
  compressedTokens: number
}

const DEFAULTS = {
  maxMessages: 8,
  maxTokens: 1500,
}

function formatHistoryForSummary(history: HistoryMessage[]): string {
  return history
    .map(m => `${m.role === "user" ? "用户" : "AI"}: ${m.content}`)
    .join("\n")
}

/**
 * 压缩对话历史
 */
export async function compressHistory(
  history: HistoryMessage[],
  options: CompressHistoryOptions = {},
): Promise<CompressResult> {
  const maxMessages = options.maxMessages ?? DEFAULTS.maxMessages
  const maxTokens = options.maxTokens ?? DEFAULTS.maxTokens

  const originalTokens = history.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0,
  )

  if (history.length <= maxMessages && originalTokens <= maxTokens) {
    return {
      messages: history,
      compressed: false,
      originalTokens,
      compressedTokens: originalTokens,
    }
  }

  const recent = history.slice(-maxMessages)

  const old = history.slice(0, -maxMessages)
  if (old.length === 0) {
    return {
      messages: recent,
      compressed: true,
      originalTokens,
      compressedTokens: recent.reduce(
        (sum, m) => sum + estimateTokens(m.content),
        0,
      ),
    }
  }

  if (!options.llmCaller) {
    return {
      messages: recent,
      compressed: true,
      originalTokens,
      compressedTokens: recent.reduce(
        (sum, m) => sum + estimateTokens(m.content),
        0,
      ),
    }
  }

  try {
    const historyText = formatHistoryForSummary(old)
    const summaryRaw = await options.llmCaller(HistoryPrompts.summarize(historyText))
    const summary = summaryRaw
      .replace(/^前情提要[：:]\s*/g, "")
      .trim()
      .slice(0, 800)

    if (!summary) {
      return {
        messages: recent,
        compressed: true,
        originalTokens,
        compressedTokens: recent.reduce(
          (sum, m) => sum + estimateTokens(m.content),
          0,
        ),
      }
    }

    const summaryMsg: HistoryMessage = {
      role: "system",
      content: `[前情提要] ${summary}`,
    }

    const messages = [summaryMsg, ...recent]
    return {
      messages,
      summary,
      compressed: true,
      originalTokens,
      compressedTokens: messages.reduce(
        (sum, m) => sum + estimateTokens(m.content),
        0,
      ),
    }
  } catch (err) {
    logger.error("[history-compressor] LLM 压缩失败，退化滑动窗口:", err)
    return {
      messages: recent,
      compressed: true,
      originalTokens,
      compressedTokens: recent.reduce(
        (sum, m) => sum + estimateTokens(m.content),
        0,
      ),
    }
  }
}
