/**
 * LLM 调用信号量(并发限流)
 * 防止并发量突增打爆上游 QPM/TPM 配额。
 * 计数 + FIFO 队列:maxConcurrency 个并发槽位,空闲时直接放行;
 * 槽位占满时入队;队列达到 maxQueue 直接 reject,不堆积。
 * 配置:环境变量 LLM_MAX_CONCURRENCY / LLM_MAX_QUEUE 优先,
 *       runtimeConfig.llmMaxConcurrency / llmMaxQueue 次之,否则默认 5 / 200。
 */

const LLM_LIMITER_DEFAULTS = {
  maxConcurrency: 5,
  maxQueue: 200,
}

function readLimiterConfig() {
  const envConc = Number(process.env.LLM_MAX_CONCURRENCY)
  const envQueue = Number(process.env.LLM_MAX_QUEUE)
  return {
    maxConcurrency:
      envConc > 0
        ? envConc
        : Number(useRuntimeConfig().llmMaxConcurrency) ||
          LLM_LIMITER_DEFAULTS.maxConcurrency,
    maxQueue:
      envQueue > 0
        ? envQueue
        : Number(useRuntimeConfig().llmMaxQueue) ||
          LLM_LIMITER_DEFAULTS.maxQueue,
  }
}

class LLMSemaphore {
  private active = 0
  private queue: Array<() => void> = []
  private cfg: { maxConcurrency: number; maxQueue: number }

  constructor() {
    this.cfg = readLimiterConfig()
  }

  /**
   * 拿一个调用槽位;调用方必须在 finally 中调用返回的 release()
   * 队列满则立即 reject,避免无限堆积把进程拖死
   */
  acquire(): Promise<() => void> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.cfg.maxQueue) {
        reject(
          new Error(
            `LLM 调用队列已满(${this.queue.length}/${this.cfg.maxQueue}),请稍后再试`,
          ),
        )
        return
      }
      this.queue.push(() => {
        this.active++
        let released = false
        const release = () => {
          if (released) return
          released = true
          this.active = Math.max(0, this.active - 1)
          this.pump()
        }
        resolve(release)
      })
      this.pump()
    })
  }

  private pump() {
    while (
      this.active < this.cfg.maxConcurrency &&
      this.queue.length > 0
    ) {
      const next = this.queue.shift()!
      next()
    }
  }

  stats() {
    return {
      active: this.active,
      queued: this.queue.length,
      ...this.cfg,
    }
  }
}

const llmSemaphore = new LLMSemaphore()

/**
 * 拿一个 LLM 调用槽位
 *  - 必须用 try { ... } finally { release() } 保证释放
 *  - 队列满时 reject,调用方应捕获并返回 503
 */
export async function acquireLLMSlot(): Promise<() => void> {
  return llmSemaphore.acquire()
}

/**
 * 查看限流器状态(监控用)
 */
export function getLLMLimiterStats() {
  return llmSemaphore.stats()
}
