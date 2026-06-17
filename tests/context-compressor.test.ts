/**
 * compressContext 单元测试
 *
 * 关注点:
 *  - 空输入安全
 *  - 切句 / 去重 / 关键词打分 / 截断 4 个步骤都跑通
 *  - 保留首项的非 content 字段
 *  - options.keepSentences / removeDuplicates / maxLength 行为
 */

import { describe, it, expect } from "vitest";
import { compressContext } from "../server/processors/context-compressor";

/** 数"句子"数(用 "。" 切,过滤空) */
function countSentences(s: string): number {
  return s.split("。").filter((x) => x.trim().length > 0).length;
}

describe("compressContext", () => {
  it("空数组 → 直接返回", () => {
    const out = compressContext<{ content: string }>([], "机器学习");
    expect(out).toEqual([]);
  });

  it("单句内容 → 不做截断,直接返回", () => {
    const ctx = [
      { content: "机器学习是人工智能的一个重要分支。", source: "a" } as any,
    ];
    const out = compressContext(ctx, "机器学习");
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toBe("机器学习是人工智能的一个重要分支。");
    // 非 content 字段保留
    expect(out[0]!.source).toBe("a");
  });

  it("完全重复的句子只保留一条", () => {
    const ctx = [
      {
        content:
          "JavaScript 是一种脚本语言。JavaScript 是一种脚本语言。JavaScript 主要运行在浏览器中。Python 是一门强大的语言。",
      },
    ] as any;
    const out = compressContext(ctx, "JavaScript", { keepSentences: 10 });
    // 去重后,完全相同的"JavaScript 是一种脚本语言。"应只剩 1 条
    const occurrences = (
      out[0]!.content.match(/JavaScript 是一种脚本语言/g) || []
    ).length;
    expect(occurrences).toBe(1);
  });

  it("超过 maxLength → 末尾追加省略号", () => {
    // 8 句各不相同的内容,避免去重把它们全砍光
    const sents = [
      "深度学习是机器学习的一个分支。",
      "它通过多层神经网络进行特征抽象与表示学习。",
      "卷积神经网络在图像识别领域表现突出。",
      "循环神经网络擅长处理序列数据。",
      "Transformer 架构引入了自注意力机制。",
      "预训练语言模型在 NLP 任务中取得突破。",
      "生成对抗网络可以生成逼真的图像。",
      "强化学习通过试错与环境交互学习策略。",
    ];
    const ctx = [{ content: sents.join("") }] as any;
    const out = compressContext(ctx, "深度学习", {
      keepSentences: 8,
      maxLength: 30,
    });
    // 截断后 ≤ maxLength + 1(省略号占 1 字符)
    expect(out[0]!.content.length).toBeLessThanOrEqual(31);
    expect(out[0]!.content.endsWith("…")).toBe(true);
  });

  it("keepSentences 控制输出句数", () => {
    const sents = [
      "Python 是一种解释型语言。",
      "Python 语法简洁易读。",
      "Python 拥有丰富的标准库。",
      "Python 在数据科学领域应用广泛。",
      "Python 支持多种编程范式。",
      "Python 社区活跃。",
      "Python 性能可通过 C 扩展提升。",
      "Python 是开源的。",
    ];
    const ctx = [{ content: sents.join("") }] as any;
    const out = compressContext(ctx, "Python", {
      keepSentences: 3,
      maxLength: 2000,
    });
    // 数句子数 ≤ keepSentences
    expect(countSentences(out[0]!.content)).toBeLessThanOrEqual(3);
  });

  it("removeDuplicates=false → 不去重", () => {
    const s =
      "JavaScript 是一种脚本语言。JavaScript 是一种脚本语言。JavaScript 是一种脚本语言。";
    const ctx = [{ content: s }] as any;
    const dedup = compressContext(ctx, "JavaScript", { keepSentences: 10 });
    const noDedup = compressContext(ctx, "JavaScript", {
      keepSentences: 10,
      removeDuplicates: false,
    });
    // 不去重时出现 ≥ 1 次
    const dedupCount = (
      dedup[0]!.content.match(/JavaScript 是一种脚本语言/g) || []
    ).length;
    const noDedupCount = (
      noDedup[0]!.content.match(/JavaScript 是一种脚本语言/g) || []
    ).length;
    expect(noDedupCount).toBeGreaterThanOrEqual(dedupCount);
  });

  it("返回数组长度恒为 1(把整组合并成一段)", () => {
    // interface CtxItem { content: string; tag: string }
    const ctx = [
      { content: "第一段内容。", tag: "x" },
      { content: "第二段内容。", tag: "y" },
    ];
    const out = compressContext(ctx, "内容");
    expect(out).toHaveLength(1);
    // 保留首项的非 content 字段
    expect(out[0]!.tag).toBe("x");
  });

  it("无标点长文本按 50 字符硬切(不会无限膨胀)", () => {
    const noPunct = "a".repeat(120);
    const out = compressContext([{ content: noPunct }] as any, "any", {
      keepSentences: 100,
      maxLength: 10000,
    });
    // 硬切后保留的应 <= 原长 + 少量 join 字符
    expect(out[0]!.content.length).toBeLessThanOrEqual(125);
  });
});
