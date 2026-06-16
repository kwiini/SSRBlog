/**
 * 服务端认证工具(RBAC 版)
 *
 * - HMAC-SHA256 签名的 JWT,载荷 { sub, uid, role, username, iat, exp }
 * - 登录走 user-store.verifyCredentials(支持多用户)
 * - 提供 requireAuth / requirePermission / hasPermission 三个闸门
 * - 启动时自动 bootstrap admin(从 env 读,无用户表时建一个)
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import { bootstrapAdmin, verifyCredentials } from "./user-store"
import { getPermissionsForRole, roleHasPermission, type Permission, type Role } from "./rbac"

const TOKEN_TTL = 7 * 24 * 3600 * 1000 // 7 天
const COOKIE_NAME = "admin_token"

export interface JwtPayload {
  /** 兼容旧字段:角色 */
  sub: Role
  /** 用户 ID */
  uid: string
  /** 用户名 */
  username: string
  /** 角色(冗余存一份方便中间件) */
  role: Role
  iat: number
  exp: number
}

/* ─── 配置 ───────────────────────────────────────────── */

function getJwtSecret(): string {
  const config = useRuntimeConfig?.() ?? {}
  return (config.jwtSecret as string) ||
    (process.env.JWT_SECRET as string) ||
    (config.adminPassword as string) ||
    (process.env.ADMIN_PASSWORD as string) ||
    "curata-default-jwt-secret"
}

/* ─── JWT 签发 / 验证 ────────────────────────────────── */

function signToken(payload: JwtPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = createHmac("sha256", getJwtSecret())
    .update(`${header}.${body}`)
    .digest("base64url")
  return `${header}.${body}.${signature}`
}

function verifyToken(token: string): JwtPayload | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const header = parts[0]!
  const body = parts[1]!
  const signature = parts[2]!

  const expected = createHmac("sha256", getJwtSecret())
    .update(`${header}.${body}`)
    .digest("base64url")

  try {
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return null
    if (!timingSafeEqual(sigBuf, expBuf)) return null
  } catch {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as JwtPayload
    if (!payload.uid || !payload.role) return null
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/* ─── 登录(已迁移到 user-store) ───────────────────────── */

export async function login(username: string, password: string): Promise<JwtPayload | null> {
  // 确保 admin 已被 bootstrap(冷启动)
  await bootstrapAdmin()
  const user = await verifyCredentials(username, password)
  if (!user) return null
  return {
    sub: user.role,
    uid: user.id,
    username: user.username,
    role: user.role,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL,
  }
}

/* ─── Cookie ────────────────────────────────────────── */

export function issueToken(event: any, payload: JwtPayload): string {
  const token = signToken(payload)
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL / 1000,
  })
  return token
}

export function clearToken(event: any): void {
  setCookie(event, COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

/* ─── 闸门 ────────────────────────────────────────────── */

/**
 * 必须登录:返回载荷
 * 401 / 过期
 */
export function requireAuth(event: any): JwtPayload {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) {
    throw createError({ statusCode: 401, message: "未登录" })
  }
  const payload = verifyToken(token)
  if (!payload) {
    throw createError({ statusCode: 401, message: "登录已过期" })
  }
  return payload
}

/**
 * 必须拥有某权限
 * 401 未登录 / 403 权限不足
 */
export function requirePermission(event: any, perm: Permission): JwtPayload {
  const payload = requireAuth(event)
  if (!roleHasPermission(payload.role, perm)) {
    throw createError({ statusCode: 403, message: `权限不足:需要 ${perm}` })
  }
  return payload
}

/**
 * 必须拥有全部权限
 */
export function requireAllPermissions(event: any, perms: Permission[]): JwtPayload {
  const payload = requireAuth(event)
  for (const p of perms) {
    if (!roleHasPermission(payload.role, p)) {
      throw createError({ statusCode: 403, message: `权限不足:需要 ${p}` })
    }
  }
  return payload
}

/**
 * 必须拥有任一权限
 */
export function requireAnyPermission(event: any, perms: Permission[]): JwtPayload {
  const payload = requireAuth(event)
  if (!perms.some(p => roleHasPermission(payload.role, p))) {
    throw createError({ statusCode: 403, message: `权限不足:需要 ${perms.join(" / ")} 之一` })
  }
  return payload
}

/**
 * 可选认证(不抛错,返回 null)
 */
export function optionalAuth(event: any): JwtPayload | null {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return null
  return verifyToken(token)
}

/**
 * 角色 → 权限列表(导出供前端用)
 */
export { getPermissionsForRole, roleHasPermission, type Permission, type Role }
