/**
 * 向量存储(SQLite + sqlite-vec)
 *
 * 替代老的 data/blog-vectors.json:
 *  - 写入:单条 INSERT OR REPLACE,大批量走事务,毫秒级完成
 *  - 读取:KNN 走 vec0 虚表的 MATCH 算子(走 HNSW/IVF 索引)
 *  - 元数据过滤:WHERE source/title 命中,KNN 不丢精度
 *  - 并发:WAL 模式,读不阻塞写,写不阻塞读
 *  - 增量:INSERT OR REPLACE(同 id 覆盖),DELETE BY source
 *
 * 配合 ../../retrieval/bm25 协同工作 —— BM25 仍走全量扫描拿文本,
 * 向量检索改走本模块的 searchByVector。
 */

import Database from "better-sqlite3";
import { load as loadSqliteVec } from "sqlite-vec";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

const DEFAULT_DIM = 1024; // DashScope text-embedding-v3
const DEFAULT_DB_PATH = join(process.cwd(), "data", "curata.db");

let _db: Database.Database | null = null;
let _dim = DEFAULT_DIM;

/** chunk 记录(对外结构,跟旧的 VectorStore.chunks[] 形状一致) */
export interface ChunkRecord {
  id: string;
  content: string;
  source: string;
  title: string;
  path: string;
  chunkIndex: number;
  chunkTotal: number;
  embedding: number[];
}

/** 向量检索命中 */
export interface SearchHit {
  id: string;
  source: string;
  title: string;
  path: string;
  chunkIndex: number;
  chunkTotal: number;
  content: string;
  /** sqlite-vec 的 L2/cosine distance(越低越相似) */
  distance: number;
  /** 1 - distance(与原 cosineSimilarity 语义一致,值越大越相似) */
  similarity: number;
}

/** 关 db(测试 / 热重载用) */
export function closeVectorDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/** 拿单例 db;首次调用时建表、加载扩展、开启 WAL */
export function getVectorDb(opts?: {
  path?: string;
  dim?: number;
}): Database.Database {
  if (_db) return _db;

  const path = opts?.path ?? DEFAULT_DB_PATH;
  _dim = opts?.dim ?? DEFAULT_DIM;

  // 建目录
  const dir = path.replace(/[\\/][^\\/]+$/, "");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("busy_timeout = 5000");

  loadSqliteVec(_db);
  ensureSchema(_db, _dim);
  return _db;
}

/** 建表(幂等) */
export function ensureSchema(db: Database.Database, dim: number): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
      id TEXT PRIMARY KEY,
      embedding float[${dim}] distance_metric=cosine,
      source TEXT,
      title TEXT,
      path TEXT,
      chunk_index INTEGER,
      chunk_total INTEGER,
      content TEXT
    );
  `);
  // vec0 的辅助列(source / title / path)本身支持 WHERE 过滤,
  // 不需要 (也不允许) CREATE INDEX。
}

/** number[] → Float32 字节流(sqlite-vec 的 MATCH 接收 Buffer) */
export function embeddingToBuffer(emb: number[]): Buffer {
  const f32 = new Float32Array(emb);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

/** Buffer → number[] */
export function bufferToEmbedding(buf: Buffer): number[] {
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return Array.from(f32);
}

/**
 * 批量 upsert(同 id 覆盖)
 * 走事务,1000 条 < 50ms
 *
 * 注意:vec0 不支持 INSERT OR REPLACE,需要先 DELETE 再 INSERT
 */
export function upsertChunks(chunks: ChunkRecord[]): void {
  if (chunks.length === 0) return;
  const db = getVectorDb();

  const stmt = db.prepare(`
    INSERT INTO vec_chunks
      (id, embedding, source, title, path, chunk_index, chunk_total, content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const ids = chunks.map((c) => c.id);
  const tx = db.transaction((batch: ChunkRecord[]) => {
    // 1) 先把同 id 的旧行清掉
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM vec_chunks WHERE id IN (${placeholders})`).run(
      ...ids,
    );

    // 2) 再插新行
    for (const c of batch) {
      stmt.run(
        c.id,
        embeddingToBuffer(c.embedding),
        c.source,
        c.title,
        c.path,
        // sqlite-vec 强类型 INTEGER 列 → BigInt 强制 INTEGER 绑定
        BigInt(c.chunkIndex | 0),
        BigInt(c.chunkTotal | 0),
        c.content,
      );
    }
  });

  tx(chunks);
  clearAllChunksCache();
}

/** 按文章路径删除(向量化单文章前先清掉旧 chunk) */
export function deleteBySource(source: string): number {
  const db = getVectorDb();
  const r = db.prepare(`DELETE FROM vec_chunks WHERE source = ?`).run(source);
  return r.changes;
}

/** 按 chunk id 删除 */
export function deleteById(id: string): number {
  const db = getVectorDb();
  const r = db.prepare(`DELETE FROM vec_chunks WHERE id = ?`).run(id);
  return r.changes;
}

/** 拿单条 chunk(给前端直接 fetch 用) */
export function getById(id: string): ChunkRecord | null {
  const db = getVectorDb();
  const row = db
    .prepare(
      `SELECT id, source, title, path, chunk_index, chunk_total, content, embedding
       FROM vec_chunks WHERE id = ?`,
    )
    .get(id) as any;
  if (!row) return null;
  return rowToChunk(row);
}

/** 拿某文章的全部 chunk */
export function getBySource(source: string): ChunkRecord[] {
  const db = getVectorDb();
  const rows = db
    .prepare(
      `SELECT id, source, title, path, chunk_index, chunk_total, content, embedding
       FROM vec_chunks WHERE source = ? ORDER BY chunk_index ASC`,
    )
    .all(source) as any[];
  return rows.map(rowToChunk);
}

/** 全量拿 chunk(给 BM25 用) */
export function getAllChunks(): ChunkRecord[] {
  const db = getVectorDb();
  const rows = db
    .prepare(
      `SELECT id, source, title, path, chunk_index, chunk_total, content, embedding
       FROM vec_chunks`,
    )
    .all() as any[];
  return rows.map(rowToChunk);
}

// · 全量缓存(60s TTL,给 hybrid 召回用)
let _allChunksCache: { data: ChunkRecord[]; time: number } | null = null;
const CACHE_TTL = 60_000;

export function getAllChunksCached(): ChunkRecord[] {
  const now = Date.now();
  if (_allChunksCache && now - _allChunksCache.time < CACHE_TTL) {
    return _allChunksCache.data;
  }
  const data = getAllChunks();
  _allChunksCache = { data, time: now };
  return data;
}

export function clearAllChunksCache(): void {
  _allChunksCache = null;
}

/** 总数 */
export function countChunks(): number {
  const db = getVectorDb();
  return (db.prepare(`SELECT COUNT(*) AS n FROM vec_chunks`).get() as any)
    .n as number;
}

/** 清空全部(给 DELETE /api/blog/vectorize 用) */
export function clearAllChunks(): number {
  const db = getVectorDb();
  const r = db.prepare(`DELETE FROM vec_chunks`).run();
  clearAllChunksCache();
  return r.changes;
}

/** KNN 向量检索 */
export function searchByVector(
  queryEmbedding: number[],
  opts: { topK: number; source?: string; threshold?: number } = { topK: 10 },
): SearchHit[] {
  const db = getVectorDb();
  const params: any[] = [embeddingToBuffer(queryEmbedding)];
  let where = `embedding MATCH ?`;
  if (opts.source) {
    where += ` AND source = ?`;
    params.push(opts.source);
  }
  const rows = db
    .prepare(
      `SELECT id, source, title, path, chunk_index, chunk_total, content, distance
       FROM vec_chunks
       WHERE ${where}
       ORDER BY distance
       LIMIT ?`,
    )
    .all(...params, opts.topK) as any[];

  const threshold = opts.threshold ?? 0;
  return rows.map(rowToHit).filter((h) => h.similarity >= threshold);
}

// · 内部工具

function rowToChunk(r: any): ChunkRecord {
  return {
    id: r.id,
    source: r.source,
    title: r.title,
    path: r.path,
    chunkIndex: r.chunk_index,
    chunkTotal: r.chunk_total,
    content: r.content,
    embedding: bufferToEmbedding(r.embedding),
  };
}

function rowToHit(r: any): SearchHit {
  return {
    id: r.id,
    source: r.source,
    title: r.title,
    path: r.path,
    chunkIndex: r.chunk_index,
    chunkTotal: r.chunk_total,
    content: r.content,
    distance: r.distance,
    similarity: 1 - r.distance,
  };
}
