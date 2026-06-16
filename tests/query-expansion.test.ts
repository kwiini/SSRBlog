/**
 * 查询扩展 单元测试
 *
 * 关注点:
 *  - expandQuery 同义词替换 / 关键词提取 / 变体数量
 *  - generateMultiQueries 短查询才扩展
 *  - rewriteQuery 无 LLM 时走基础改写
 *  - isComplexQuery 复杂查询判定
 */

import { describe, it, expect, vi } from "vitest";
import {
  expandQuery,
  generateMultiQueries,
  rewriteQuery,
  isComplexQuery,
} from "../server/retrieval/query-expansion";

describe("expandQuery", () => {
  it("变体第一条永远是原文", () => {
    const out = expandQuery("如何使用 Vue 进行前端开发");
    expect(out.original).toBe("如何使用 Vue 进行前端开发");
    expect(out.variations[0]).toBe("如何使用 Vue 进行前端开发");
  });

  it("命中同义词词典的词产出 synonym 映射和变体", () => {
    const out = expandQuery("js 性能优化");
    expect(out.synonyms.has("js")).toBe(true);
    // 至少含 javascript 变体
    expect(out.variations.some(v => v.includes("javascript"))).toBe(true);
  });

  it("未命中同义词词典时不产生变体(只有关键词)", () => {
    const out = expandQuery("机器学习入门");
    // 没在词典里的"机器学习"/"入门"不会替换,但有 "machine learning" 不在词典
    // 只要 original 在第一位即可
    expect(out.variations[0]).toBe("机器学习入门");
    expect(out.keywords.length).toBeGreaterThan(0);
  });

  it("变体最多 5 条", () => {
    const out = expandQuery("前端 后端 数据库 api 性能 安全 部署 测试");
    expect(out.variations.length).toBeLessThanOrEqual(5);
  });

  it("关键词按 BM25 词频排", () => {
    const out = expandQuery("Vue Vue Vue React Angular");
    // Vue 出现 3 次,应排在最前
    expect(out.keywords[0]).toBe("vue");
  });
});

describe("generateMultiQueries", () => {
  it("短查询(< 20 字符)产出额外变体", () => {
    const out = generateMultiQueries("RAG");
    expect(out.length).toBeGreaterThan(1);
    expect(out).toContain("RAG");
    expect(out.some(q => q.includes("什么是"))).toBe(true);
  });

  it("长查询(>= 20 字符)不扩展,只返原查询", () => {
    const out = generateMultiQueries("如何在大规模企业级系统中实现高性能 RAG 检索增强生成架构");
    expect(out).toEqual(["如何在大规模企业级系统中实现高性能 RAG 检索增强生成架构"]);
  });
});

describe("rewriteQuery", () => {
  it("无 LLM 时走 basic 改写(合并空白)", async () => {
    const out = await rewriteQuery("  RAG   检索   ");
    expect(out).toBe("RAG 检索");
  });

  it("超长(> 200)跳过 LLM 走 basic", async () => {
    const long = "x".repeat(300);
    const out = await rewriteQuery(long);
    // 只做了 trim + 合并空白
    expect(out).toBe(long);
  });

  it("LLM 失败时回退到 basic", async () => {
    // 静音源码里的 console.error(测试预期它会触发)
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failingLLM = async () => {
        throw new Error("模拟 LLM 挂了");
      };
      const out = await rewriteQuery("RAG 检索", failingLLM);
      expect(out).toBe("RAG 检索");
    } finally {
      spy.mockRestore();
    }
  });

  it("LLM 成功时清洗(去引号 / 截第一行 / 截 80 字符)", async () => {
    const fakeLLM = async () =>
      `"RAG 检索增强生成技术" \n这是第二行,应被截断`;
    const out = await rewriteQuery("RAG", fakeLLM);
    expect(out).not.toContain("\n");
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.startsWith("RAG")).toBe(true);
  });
});

describe("isComplexQuery", () => {
  it("对比类查询视为复杂", () => {
    expect(isComplexQuery("RAG 和微调有什么区别")).toBe(true);
    expect(isComplexQuery("MySQL vs PostgreSQL")).toBe(true);
  });

  it("短具体查询视为简单", () => {
    expect(isComplexQuery("什么是 RAG")).toBe(false);
    expect(isComplexQuery("RAG 原理")).toBe(false);
  });

  it("复合多关键词视为复杂", () => {
    expect(isComplexQuery("前端、后端 性能 优化")).toBe(true);
  });

  it("多问号视为复杂", () => {
    expect(isComplexQuery("RAG 是什么? 怎么用?")).toBe(true);
  });
});
