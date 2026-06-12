/**
 * 服务端认证工具
 * - HMAC-SHA256 签名的 JWT（无外部依赖）
 * - 箾出/验证/中间件
 * - 密码从环境变量 ADMIN_PASSWORD 读取，默认 admin123
 */
import { createHmac, timingSafeEqual } from "crypto";

// ─── 配置 ───────────────────────────────────────────────
function getAdminPassword(): string {
  const config = useRuntimeConfig();
  return (config.adminPassword as string) || "admin123";
}

function getJwtSecret(): string {
  const config = useRuntimeConfig();
  // 优先用专用密钥，否则用密码派生
  return (config.jwtSecret as string) || getAdminPassword();
}

const TOKEN_TTL = 7 * 24 * 3600 * 1000; // 7 天（毫秒）
const COOKIE_NAME = "admin_token";

// ─── JWT 签发 / 验证 ────────────────────────────────────
interface JwtPayload {
  sub: "admin";
  iat: number; // 签发时间 ms
  exp: number; // 过期时间 ms
}

function signToken(payload: JwtPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getJwtSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const header = parts[0]!;
  const body = parts[1]!;
  const signature = parts[2]!;

  // 验签
  const expected = createHmac("sha256", getJwtSecret())
    .update(`${header}.${body}`)
    .digest("base64url");

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8")
    ) as JwtPayload;
    if (payload.sub !== "admin") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── 登录校验 ───────────────────────────────────────────
export function verifyPassword(password: string): boolean {
  const expected = getAdminPassword();
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── 签发并设置 Cookie ─────────────────────────────────
export function issueToken(event: any): string {
  const now = Date.now();
  const token = signToken({ sub: "admin", iat: now, exp: now + TOKEN_TTL });

  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL / 1000,
  });

  return token;
}

// ─── 清除 Cookie ────────────────────────────────────────
export function clearToken(event: any): void {
  setCookie(event, COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// ─── 从请求中提取并验证 JWT ─────────────────────────────
export function requireAuth(event: any): JwtPayload {
  const token = getCookie(event, COOKIE_NAME);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "未登录" });
  }
  const payload = verifyToken(token);
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: "登录已过期" });
  }
  return payload;
}

// ─── 可选认证（不抛错，返回 null） ──────────────────────
export function optionalAuth(event: any): JwtPayload | null {
  const token = getCookie(event, COOKIE_NAME);
  if (!token) return null;
  return verifyToken(token);
}
