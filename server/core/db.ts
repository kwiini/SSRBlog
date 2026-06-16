/**
 * SQLite 持久化工具(better-sqlite3 单例)
 * 用于文献综述归档:reviews + review_papers 两张表,关联一对多
 * 业务场景:央企办公室需要可追溯的历史归档
 */
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

// 数据库文件位置:项目 data/ 目录
const DB_DIR = join(process.cwd(), "data");
const DB_PATH = join(DB_DIR, "literature-review.db");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  // WAL 模式提升并发读写性能
  db.pragma("journal_mode = WAL");
  // 启用外键约束
  db.pragma("foreign_keys = ON");

  // 初始化表结构
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT,
      field TEXT,
      background TEXT,
      innovation TEXT,
      trend TEXT,
      thoughts TEXT,
      reporter TEXT,
      review_date TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

    CREATE TABLE IF NOT EXISTS review_papers (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL,
      name TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      is_pdf INTEGER DEFAULT 0,
      is_docx INTEGER DEFAULT 0,
      is_doc INTEGER DEFAULT 0,
      content TEXT,
      html_content TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_review_papers_review_id ON review_papers(review_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_review_id ON audit_logs(review_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
  `);

  dbInstance = db;
  return db;
}

/**
 * 生成简短 ID
 */
export function generateId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

/**
 * 写入审计日志
 * action: 'create' | 'update' | 'delete'
 */
export function logAudit(params: {
  reviewId: string;
  userId: string;
  userName?: string;
  action: string;
  detail?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_logs (id, review_id, user_id, user_name, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    generateId(),
    params.reviewId,
    params.userId,
    params.userName || null,
    params.action,
    params.detail || null,
    Date.now()
  );
}

/**
 * 健康检查
 */
export function isDbHealthy(): boolean {
  try {
    const db = getDb();
    const row = db.prepare("SELECT 1 as ok").get() as { ok: number } | undefined;
    return row?.ok === 1;
  } catch {
    return false;
  }
}
