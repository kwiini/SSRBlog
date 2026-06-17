/**
 * BM25 检索 单元测试
 *
 * 关注点:
 *  - tokenize 英文按词切、中文按词粒度(实际为 2-char)
 *  - 排名语义(相关内容 > 无关内容)
 *  - 标题加权:仅在内容也命中时生效
 *  - topK / 空输入边界
 *  - extractKeywords 去停用词 + 词频排序
 */

import { describe, it, expect } from "vitest";
import {
  bm25Search,
  extractKeywords,
  tokenize,
} from "../server/retrieval/bm25";

function doc(id: string, content: string, title: string, path = "/" + id) {
  return {
    id,
    content,
    source: "test",
    metadata: { title, path, index: 0, total: 0 },
  };
}

describe("tokenize", () => {
  it("空串 → 空数组", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("英文按词切,小写化", () => {
    const toks = tokenize("Machine Learning and Deep LEARNING");
    expect(toks).toContain("machine");
    expect(toks).toContain("learning");
    expect(toks).toContain("deep");
    // learning 应出现 2 次(大小写归一)
    expect(toks.filter((t) => t === "learning").length).toBe(2);
  });

  it("中文切出非单字词(实际环境为 2-char,稳定就好)", () => {
    const toks = tokenize("机器学习是人工智能的一个分支");
    // 不应是单字"机"/"器"/"学"/"习"
    expect(toks).not.toContain("机");
    expect(toks).not.toContain("器");
    // 至少要切出 "机器" 和 "学习" 这两个 2-char 词
    expect(toks).toContain("机器");
    expect(toks).toContain("学习");
  });
});

describe("bm25Search", () => {
  it("空 query / 空 docs → 空数组", () => {
    expect(bm25Search("", [doc("a", "foo bar", "Foo")], 5)).toEqual([]);
    expect(bm25Search("foo", [], 5)).toEqual([]);
  });

  it("相关文档排在无关文档之前,score 单调降序", () => {
    const docs = [
      doc(
        "a",
        "machine learning is a branch of AI, machine learning matters",
        "AI intro",
      ),
      doc("b", "today weather is nice, good for outing", "diary"),
      doc("c", "I like machine learning and deep learning", "notes"),
    ];
    const out = bm25Search("machine learning", docs, 10);
    expect(out.length).toBe(2);
    const ids = out.map((r) => r.id);
    expect(ids).toContain("a");
    expect(ids).toContain("c");
    expect(ids).not.toContain("b");
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]!.score).toBeGreaterThanOrEqual(out[i]!.score);
    }
  });

  it("标题 + 内容都命中 → 标题加权 1.5x 高于纯内容命中", () => {
    const docs = [
      // 内容和标题都命中 "transformer"
      doc("a", "transformer is a deep learning model.", "transformer intro"),
      // 只命中内容
      doc("b", "transformer architecture uses self-attention.", "diary"),
    ];
    const out = bm25Search("transformer", docs, 10);
    expect(out.length).toBe(2);
    expect(out[0]!.id).toBe("a");
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
    // 加权比应约为 1.5(允许一定浮点误差)
    const ratio = out[0]!.score / out[1]!.score;
    expect(ratio).toBeGreaterThan(1.0);
    expect(ratio).toBeLessThan(2.0);
  });

  it("topK 限制返回数量", () => {
    const docs = Array.from({ length: 10 }, (_, i) =>
      doc(`d${i}`, `apple fruit number ${i}`, `doc${i}`),
    );
    const out = bm25Search("apple", docs, 3);
    expect(out).toHaveLength(3);
  });

  it("完全不命中 → 返回空数组(score 全 0 被过滤)", () => {
    const docs = [
      doc("a", "today is nice.", "weather"),
      doc("b", "I love banana.", "fruit"),
    ];
    const out = bm25Search("transformer", docs, 10);
    expect(out).toEqual([]);
  });
});

describe("extractKeywords", () => {
  it("返回高频非停用词", () => {
    const kw = extractKeywords(
      "machine learning is a branch of AI. machine learning is important.",
      5,
    );
    // "machine"/"learning" 出现 2 次,且不在停用词表
    expect(kw).toContain("machine");
    expect(kw).toContain("learning");
  });

  it("过滤单字停用词", () => {
    const kw = extractKeywords(
      "I am learning some new things, this is fun.",
      5,
    );
    // 英文停用词应被过滤
    expect(kw).not.toContain("i");
    expect(kw).not.toContain("is");
    expect(kw).not.toContain("a");
  });

  it("maxKeywords 限制返回数量", () => {
    const kw = extractKeywords(
      "apple banana orange grape watermelon peach pear cherry strawberry blueberry",
      3,
    );
    expect(kw.length).toBeLessThanOrEqual(3);
  });

  it("词频越高排名越前", () => {
    const kw = extractKeywords("vue vue vue react angular", 5);
    expect(kw[0]).toBe("vue");
  });
});
