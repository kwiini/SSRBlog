/**
 * 一次性迁移:老的 data/blog-vectors.json → data/curata.db(vec0 表)
 *
 * 触发:
 *  - 显式调用 migrateFromJson()(向量化 API 启动时检测)
 *  - 命令行: `node --experimental-strip-types server/retrieval/migrate-vectors.ts`
 *
 * 行为:
 *  1. 读 JSON
 *  2. 用 upsertChunks 写到新表(走事务)
 *  3. 把 JSON 改名 .bak(只改一次,不丢数据)
 *  4. 若 JSON 不存在,直接返回
 */

import { promises as fs } from "fs";
import { join } from "path";
import {
  upsertChunks,
  getVectorDb,
  closeVectorDb,
  type ChunkRecord,
} from "./vector-db";
import { logger } from "../lib/logger";

interface OldVectorStore {
  version: string;
  lastUpdated: string;
  chunks: Array<{
    id: string;
    content: string;
    embedding: number[];
    source: string;
    metadata: { title: string; path: string; index: number; total: number };
  }>;
}

const OLD_PATH = join(process.cwd(), "data", "blog-vectors.json");
const BAK_PATH = OLD_PATH + ".bak";

export interface MigrationResult {
  migrated: number;
  alreadyMigrated: boolean;
  jsonMissing: boolean;
  backupPath: string | null;
}

export async function migrateFromJson(
  jsonPath: string = OLD_PATH,
  bakPath: string = BAK_PATH,
): Promise<MigrationResult> {
  // 0. 先确保 db 存在
  getVectorDb();

  // 1. 检查 JSON 是否存在
  try {
    await fs.access(jsonPath);
  } catch {
    return {
      migrated: 0,
      alreadyMigrated: false,
      jsonMissing: true,
      backupPath: null,
    };
  }

  // 2. 读 JSON
  const raw = await fs.readFile(jsonPath, "utf-8");
  const store = JSON.parse(raw) as OldVectorStore;
  if (!store.chunks || store.chunks.length === 0) {
    // 空的 JSON,直接备份
    await fs.rename(jsonPath, bakPath);
    return {
      migrated: 0,
      alreadyMigrated: false,
      jsonMissing: false,
      backupPath: bakPath,
    };
  }

  // 3. 转结构并写入
  const records: ChunkRecord[] = store.chunks.map((c) => ({
    id: c.id,
    content: c.content,
    source: c.source,
    title: c.metadata.title,
    path: c.metadata.path,
    chunkIndex: c.metadata.index,
    chunkTotal: c.metadata.total,
    embedding: c.embedding,
  }));

  upsertChunks(records);

  // 4. 备份(改名,不删)
  await fs.rename(jsonPath, bakPath);

  return {
    migrated: records.length,
    alreadyMigrated: false,
    jsonMissing: false,
    backupPath: bakPath,
  };
}

/** 命令行直接跑 */
async function main() {
  try {
    const r = await migrateFromJson();
    if (r.jsonMissing) {
      logger.info(
        `[migrate] JSON 不存在,跳过(data/curata.db 当前 ${getVectorDb().prepare("SELECT COUNT(*) AS n FROM vec_chunks").get() as any} 条)`,
      );
    } else if (r.migrated > 0) {
      logger.info(`[migrate] 成功迁移 ${r.migrated} 条 → ${r.backupPath}`);
    } else {
      logger.info(`[migrate] JSON 为空,已备份到 ${r.backupPath}`);
    }
  } catch (e) {
    logger.error("[migrate] 失败:", e);
    process.exit(1);
  } finally {
    closeVectorDb();
  }
}

// 仅当被直接当脚本执行时跑(ESM 没有 require.main, 走 argv 末位判断)
const isMain =
  process.argv[1] && process.argv[1].endsWith("migrate-vectors.ts");
if (isMain) {
  main();
}
