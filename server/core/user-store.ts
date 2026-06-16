/**
 * 用户存储 + 密码哈希
 *
 * - JSON 文件 data/users.json 存用户表(无外部 DB 依赖)
 * - PBKDF2-SHA512 密码哈希(100k 迭代 + per-user 16B salt)
 * - bootstrap: 首次启动且用户表为空时,从 ADMIN_PASSWORD env 引导一个 admin
 */

import { promises as fs } from "node:fs"
import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto"
import { isValidRole, type Role } from "./rbac"

import { logger } from "../lib/logger";

export interface StoredUser {
  id: string
  username: string
  passwordHash: string  // base64
  salt: string          // base64
  role: Role
  createdAt: number
  lastLoginAt: number | null
  disabled?: boolean
}

interface UserFile {
  users: StoredUser[]
  /** 加密算法参数(便于以后升级) */
  meta: { kdf: "pbkdf2-sha512"; iterations: number; saltBytes: number; hashBytes: number }
}

const KDF_ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BYTES = 32
const DATA_DIR = join(process.cwd(), "data")
const USERS_FILE = join(DATA_DIR, "users.json")

/* ─── 文件 IO ─────────────────────────────────────────── */

function defaultFile(): UserFile {
  return {
    users: [],
    meta: { kdf: "pbkdf2-sha512", iterations: KDF_ITERATIONS, saltBytes: SALT_BYTES, hashBytes: HASH_BYTES },
  }
}

async function readFile(): Promise<UserFile> {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!existsSync(USERS_FILE)) {
    return defaultFile()
  }
  try {
    const text = await fs.readFile(USERS_FILE, "utf-8")
    const parsed = JSON.parse(text) as UserFile
    if (!parsed.users || !Array.isArray(parsed.users)) return defaultFile()
    return parsed
  } catch {
    return defaultFile()
  }
}

async function writeFile(file: UserFile): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  // 写临时文件再 rename,避免半写崩盘
  const tmp = USERS_FILE + ".tmp"
  await fs.writeFile(tmp, JSON.stringify(file, null, 2), "utf-8")
  await fs.rename(tmp, USERS_FILE)
}

/* ─── 密码哈希 ────────────────────────────────────────── */

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const saltBuf = salt ? Buffer.from(salt, "base64") : randomBytes(SALT_BYTES)
  const hashBuf = pbkdf2Sync(password, saltBuf, KDF_ITERATIONS, HASH_BYTES, "sha512")
  return {
    hash: hashBuf.toString("base64"),
    salt: saltBuf.toString("base64"),
  }
}

export function verifyPasswordHash(password: string, hash: string, salt: string): boolean {
  const { hash: candidate } = hashPassword(password, salt)
  const a = Buffer.from(candidate)
  const b = Buffer.from(hash)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/* ─── bootstrap ──────────────────────────────────────── */

let bootstrapped = false

/**
 * 启动时调用一次:如果用户表为空,根据 env 引导 admin
 *  - ADMIN_USERNAME (默认 "admin")
 *  - ADMIN_PASSWORD (默认 "admin123",仅在没设时生效)
 * 已存在用户表则完全不动
 */
export async function bootstrapAdmin(): Promise<void> {
  if (bootstrapped) return
  bootstrapped = true

  const file = await readFile()
  if (file.users.length > 0) return

  const config = useRuntimeConfig?.() ?? {}
  const username =
    (process.env.ADMIN_USERNAME as string) ||
    (config.adminUsername as string) ||
    "admin"
  const password =
    (process.env.ADMIN_PASSWORD as string) ||
    (config.adminPassword as string) ||
    "admin123"

  const { hash, salt } = hashPassword(password)
  const now = Date.now()
  const admin: StoredUser = {
    id: `usr_${randomBytes(6).toString("hex")}`,
    username,
    passwordHash: hash,
    salt,
    role: "admin",
    createdAt: now,
    lastLoginAt: null,
  }
  file.users.push(admin)
  await writeFile(file)
  logger.info(`[user-store] bootstrapped admin user "${username}" (set ADMIN_PASSWORD to change)`)
}

/* ─── CRUD ───────────────────────────────────────────── */

export async function listUsers(): Promise<StoredUser[]> {
  const file = await readFile()
  return file.users
}

export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  const file = await readFile()
  return file.users.find(u => u.username === username) || null
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  const file = await readFile()
  return file.users.find(u => u.id === id) || null
}

export async function verifyCredentials(username: string, password: string): Promise<StoredUser | null> {
  const user = await findUserByUsername(username)
  if (!user) return null
  if (user.disabled) return null
  if (!verifyPasswordHash(password, user.passwordHash, user.salt)) return null
  // 顺手记 lastLoginAt(异步,失败不影响登录)
  updateLastLogin(user.id).catch(() => {})
  return user
}

async function updateLastLogin(id: string): Promise<void> {
  const file = await readFile()
  const u = file.users.find(x => x.id === id)
  if (!u) return
  u.lastLoginAt = Date.now()
  await writeFile(file)
}

export interface CreateUserInput {
  username: string
  password: string
  role: Role
}

export async function createUser(input: CreateUserInput): Promise<StoredUser> {
  if (!input.username || input.username.length < 2 || input.username.length > 32) {
    throw new Error("用户名长度必须在 2-32 字符之间")
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(input.username)) {
    throw new Error("用户名只能包含字母、数字、下划线、短横线")
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("密码长度至少 6 位")
  }
  if (!isValidRole(input.role)) {
    throw new Error("非法角色")
  }

  const file = await readFile()
  if (file.users.some(u => u.username === input.username)) {
    throw new Error("用户名已存在")
  }

  const { hash, salt } = hashPassword(input.password)
  const user: StoredUser = {
    id: `usr_${randomBytes(6).toString("hex")}`,
    username: input.username,
    passwordHash: hash,
    salt,
    role: input.role,
    createdAt: Date.now(),
    lastLoginAt: null,
  }
  file.users.push(user)
  await writeFile(file)
  return user
}

export interface UpdateUserInput {
  role?: Role
  password?: string
  disabled?: boolean
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<StoredUser> {
  const file = await readFile()
  const user = file.users.find(u => u.id === id)
  if (!user) throw new Error("用户不存在")

  if (patch.role !== undefined) {
    if (!isValidRole(patch.role)) throw new Error("非法角色")
    // 保护:不能把最后一个 admin 降级
    if (user.role === "admin" && patch.role !== "admin") {
      const adminCount = file.users.filter(u => u.role === "admin" && !u.disabled).length
      if (adminCount <= 1) throw new Error("至少保留 1 个 admin")
    }
    user.role = patch.role
  }
  if (patch.password !== undefined) {
    if (patch.password.length < 6) throw new Error("密码长度至少 6 位")
    const { hash, salt } = hashPassword(patch.password)
    user.passwordHash = hash
    user.salt = salt
  }
  if (patch.disabled !== undefined) {
    // 保护:不能禁用最后一个 admin
    if (user.role === "admin" && patch.disabled) {
      const adminCount = file.users.filter(u => u.role === "admin" && !u.disabled).length
      if (adminCount <= 1) throw new Error("至少保留 1 个可用 admin")
    }
    user.disabled = patch.disabled
  }

  await writeFile(file)
  return user
}

export async function deleteUser(id: string): Promise<void> {
  const file = await readFile()
  const user = file.users.find(u => u.id === id)
  if (!user) throw new Error("用户不存在")
  // 保护:不能删除最后一个 admin
  if (user.role === "admin") {
    const adminCount = file.users.filter(u => u.role === "admin" && !u.disabled).length
    if (adminCount <= 1) throw new Error("至少保留 1 个 admin")
  }
  file.users = file.users.filter(u => u.id !== id)
  await writeFile(file)
}

/**
 * 把内部 StoredUser 转为对外安全的视图(不暴露 hash/salt)
 */
export function toPublicUser(u: StoredUser) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    disabled: u.disabled ?? false,
  }
}
