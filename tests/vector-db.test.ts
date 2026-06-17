/**
 * vector-db (sqlite-vec 后端) 单元测试
 *
 * 用临时 db 文件,跟生产 data/curata.db 完全隔离
 *  - upsert / getById / getBySource / getAllChunks
 *  - searchByVector 排序 + 阈值
 *  - 按 source 过滤
 *  - deleteBySource / deleteById
 *  - countChunks / clearAllChunks
 *  - 从 JSON 迁移(migrateFromJson)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  getVectorDb,
  closeVectorDb,
  upsertChunks,
  deleteBySource,
  deleteById,
  getById,
  getBySource,
  getAllChunks,
  countChunks,
  clearAllChunks,
  searchByVector,
  ensureSchema,
  embeddingToBuffer,
  bufferToEmbedding,
  type ChunkRecord,
} from "../server/retrieval/vector-db";
import { migrateFromJson } from "../server/retrieval/migrate-vectors";

let tmpDir: string;
let dbPath: string;

const DIM = 16; // 测试用小维度,跑得快

function makeVec(seed: number, dim: number = DIM): number[] {
  // 用 seed 算出一个"伪随机"但确定性的向量
  return Array.from(
    { length: dim },
    (_, i) => Math.sin(seed * (i + 1)) * Math.cos(i * 0.1),
  );
}

function makeChunk(
  id: string,
  source: string,
  emb: number[],
  content = "x",
): ChunkRecord {
  return {
    id,
    content,
    source,
    title: `Title of ${source}`,
    path: `/${source}`,
    chunkIndex: 0,
    chunkTotal: 1,
    embedding: emb,
  };
}

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "curata-vecdb-"));
  dbPath = join(tmpDir, "test.db");
  // 触发首次打开 + 建表
  getVectorDb({ path: dbPath, dim: DIM });
});

afterAll(() => {
  closeVectorDb();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  clearAllChunks();
  // 也清掉 in-memory cache,保证下一条用例拿最新
  // (clearAllChunks 已经清了,这里再保险一次)
});

describe("vector-db: 基础 CRUD", () => {
  it("count 初始为 0", () => {
    expect(countChunks()).toBe(0);
  });

  it("upsert 单条 + getById", () => {
    const c = makeChunk("c1", "post-a", makeVec(1));
    upsertChunks([c]);
    expect(countChunks()).toBe(1);
    const got = getById("c1");
    expect(got).not.toBeNull();
    expect(got!.source).toBe("post-a");
    // Float32 ↔ Float64 精度会有 ~1e-7 损失,逐位 toBeCloseTo
    expect(got!.embedding.length).toBe(c.embedding.length);
    for (let i = 0; i < c.embedding.length; i++) {
      expect(got!.embedding[i]).toBeCloseTo(c.embedding[i]!, 5);
    }
  });

  it("upsert 同 id 覆盖(INSERT OR REPLACE)", () => {
    upsertChunks([makeChunk("c1", "post-a", makeVec(1), "old")]);
    upsertChunks([makeChunk("c1", "post-a", makeVec(2), "new")]);
    expect(countChunks()).toBe(1);
    expect(getById("c1")!.content).toBe("new");
    // embedding 也应替换
    expect(getById("c1")!.embedding[0]).toBeCloseTo(makeVec(2)[0]!, 5);
  });

  it("upsert 1000 条走事务(总耗时应 < 500ms)", () => {
    const t0 = Date.now();
    const batch: ChunkRecord[] = Array.from({ length: 1000 }, (_, i) =>
      makeChunk(`bulk-${i}`, "post-bulk", makeVec(i + 10)),
    );
    upsertChunks(batch);
    expect(countChunks()).toBe(1000);
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it("getBySource 按 source 过滤 + 按 chunkIndex 排序", () => {
    clearAllChunks();
    upsertChunks([
      { ...makeChunk("a2", "post-x", makeVec(2)), chunkIndex: 2 },
      { ...makeChunk("a0", "post-x", makeVec(0)), chunkIndex: 0 },
      { ...makeChunk("a1", "post-x", makeVec(1)), chunkIndex: 1 },
      makeChunk("b0", "post-y", makeVec(99)),
    ]);
    const xs = getBySource("post-x");
    expect(xs).toHaveLength(3);
    expect(xs.map((c) => c.id)).toEqual(["a0", "a1", "a2"]);
  });

  it("deleteBySource 只删该 source 的", () => {
    clearAllChunks();
    upsertChunks([
      makeChunk("a", "post-a", makeVec(1)),
      makeChunk("b", "post-b", makeVec(2)),
    ]);
    const n = deleteBySource("post-a");
    expect(n).toBe(1);
    expect(getById("a")).toBeNull();
    expect(getById("b")).not.toBeNull();
  });

  it("deleteById 单条删除", () => {
    clearAllChunks();
    upsertChunks([makeChunk("a", "post-a", makeVec(1))]);
    expect(deleteById("a")).toBe(1);
    expect(deleteById("a")).toBe(0); // 二次删 0 行
  });

  it("clearAllChunks 清零", () => {
    upsertChunks([makeChunk("a", "post-a", makeVec(1))]);
    expect(clearAllChunks()).toBe(1);
    expect(countChunks()).toBe(0);
  });
});

describe("vector-db: KNN 检索", () => {
  beforeEach(() => {
    clearAllChunks();
    // 准备 5 条:q1 方向 0, q2 方向 1, q3 方向 2, noise_a, noise_b
    upsertChunks([
      makeChunk("q1", "post-q1", makeVec(100), "primary hit"),
      makeChunk("q2", "post-q2", makeVec(101), "secondary"),
      makeChunk("q3", "post-q3", makeVec(102), "third"),
      makeChunk("noise-a", "post-noise", makeVec(900), "noise"),
      makeChunk("noise-b", "post-noise", makeVec(901), "noise"),
    ]);
  });

  it("最相似的排第一(distance 最小)", () => {
    const q = makeVec(100); // 完全等于 q1
    const hits = searchByVector(q, { topK: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.id).toBe("q1");
    expect(hits[0]!.distance).toBeLessThan(hits[1]!.distance);
  });

  it("topK 限制返回数量", () => {
    const hits = searchByVector(makeVec(100), { topK: 2 });
    expect(hits).toHaveLength(2);
  });

  it("threshold 过滤掉距离大的", () => {
    // threshold 设在 0.999 = 只允许几乎完全匹配
    const hits = searchByVector(makeVec(100), { topK: 5, threshold: 0.999 });
    // 期望只命中 q1
    expect(hits.length).toBeLessThanOrEqual(1);
    if (hits.length === 1) {
      expect(hits[0]!.id).toBe("q1");
    }
  });

  it("按 source 过滤 → 只在该 source 内 KNN", () => {
    const hits = searchByVector(makeVec(100), {
      topK: 10,
      source: "post-noise",
    });
    // 只在 post-noise 里搜,该 source 内最相似的 noise-a 排第一
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.source === "post-noise")).toBe(true);
  });

  it("空库 / 空 query → 空数组(空库情况是空数组)", () => {
    clearAllChunks();
    const hits = searchByVector(makeVec(100), { topK: 5 });
    expect(hits).toEqual([]);
  });
});

describe("vector-db: embedding ↔ buffer 互转", () => {
  it("number[] → Buffer → number[] 长度一致", () => {
    const v = [1.5, -2.25, 0, 3.14159, 100];
    const buf = embeddingToBuffer(v);
    const back = bufferToEmbedding(buf);
    expect(back.length).toBe(v.length);
  });

  it("Buffer 解码后精度保留到 1e-5 (Float32 范围内)", () => {
    const v = [1.5, -2.25, 0, 3.14159, 100];
    const back = bufferToEmbedding(embeddingToBuffer(v));
    for (let i = 0; i < v.length; i++) {
      expect(back[i]).toBeCloseTo(v[i]!, 4);
    }
  });
});

describe("migrateFromJson: 一次性迁移", () => {
  it("JSON 不存在 → jsonMissing: true,迁移 0 条", async () => {
    const fakeJson = join(tmpDir, "no-such-file.json");
    const fakeBak = join(tmpDir, "no-such-file.json.bak");
    const r = await migrateFromJson(fakeJson, fakeBak);
    expect(r.jsonMissing).toBe(true);
    expect(r.migrated).toBe(0);
  });

  it("JSON 存在 → 迁移 → 备份为 .bak", async () => {
    const jsonPath = join(tmpDir, "to-migrate.json");
    const bakPath = jsonPath + ".bak";

    const old = {
      version: "1.0",
      lastUpdated: new Date().toISOString(),
      chunks: [
        {
          id: "m1",
          content: "迁移测试 1",
          embedding: makeVec(42),
          source: "/post-m",
          metadata: { title: "T", path: "/post-m", index: 0, total: 1 },
        },
        {
          id: "m2",
          content: "迁移测试 2",
          embedding: makeVec(43),
          source: "/post-m",
          metadata: { title: "T", path: "/post-m", index: 1, total: 2 },
        },
      ],
    };
    writeFileSync(jsonPath, JSON.stringify(old), "utf-8");

    // 把当前 db 清掉,确保看到迁移进来的数据
    clearAllChunks();
    const r = await migrateFromJson(jsonPath, bakPath);
    expect(r.migrated).toBe(2);
    expect(r.jsonMissing).toBe(false);
    expect(r.backupPath).toBe(bakPath);

    // JSON 已被改名
    expect(existsSync(jsonPath)).toBe(false);
    expect(existsSync(bakPath)).toBe(true);

    // 数据进了 db
    const got = getById("m1");
    expect(got).not.toBeNull();
    expect(got!.source).toBe("/post-m");
    expect(got!.title).toBe("T");
  });

  it("空的 JSON(chunks: [])也走通(直接备份,迁移 0 条)", async () => {
    const jsonPath = join(tmpDir, "empty.json");
    const bakPath = jsonPath + ".bak";
    writeFileSync(
      jsonPath,
      JSON.stringify({ version: "1.0", chunks: [] }),
      "utf-8",
    );

    const r = await migrateFromJson(jsonPath, bakPath);
    expect(r.migrated).toBe(0);
    expect(existsSync(jsonPath)).toBe(false);
    expect(existsSync(bakPath)).toBe(true);
  });
});

describe("ensureSchema: 幂等", () => {
  it("重复调用不报错", () => {
    const db = getVectorDb({ path: dbPath, dim: DIM });
    expect(() => ensureSchema(db, DIM)).not.toThrow();
    expect(() => ensureSchema(db, DIM)).not.toThrow();
  });
});
