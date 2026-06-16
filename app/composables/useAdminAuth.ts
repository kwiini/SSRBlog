/**
 * 认证状态管理(RBAC 版)
 * - 登录:POST /api/auth/login,body = { username, password } → httpOnly cookie 自动写入
 * - 状态:GET /api/auth/me → 服务端验证 cookie 中的 JWT,返 role/permissions
 * - 登出:POST /api/auth/logout → 清除 cookie
 * - 前端不再存储密码,不再信任 localStorage
 */
// 仅 type-only import,编译后消失,不会把 server 模块拉进客户端 bundle
import type { Permission } from "../../server/core/rbac"

export interface AuthUser {
  isLoggedIn: boolean
  isAdmin: boolean
  role: string | null
  roleMeta?: { label: string; description: string; rank: number } | null
  username: string | null
  userId: string | null
  permissions: Permission[]
  expiresAt: number | null
}

export function useAdminAuth() {
  const isAdmin = useState("admin-auth", () => false);
  const currentUser = useState<AuthUser>("admin-auth-user", () => ({
    isLoggedIn: false,
    isAdmin: false,
    role: null,
    roleMeta: null,
    username: null,
    userId: null,
    permissions: [],
    expiresAt: null,
  }));
  const loading = ref(false);

  /** 从 FetchError 里取后端 message,优先 data.message → message */
  function extractError(err: any, fallback = "登录失败"): string {
    return err?.data?.message || err?.message || fallback;
  }

  // 页面加载时向服务端确认登录状态
  async function checkAuth(): Promise<boolean> {
    try {
      const res: any = await $fetch("/api/auth/me");
      currentUser.value = {
        isLoggedIn: !!res.isLoggedIn,
        isAdmin: !!res.isAdmin,
        role: res.role ?? null,
        roleMeta: res.roleMeta ?? null,
        username: res.username ?? null,
        userId: res.userId ?? null,
        permissions: res.permissions ?? [],
        expiresAt: res.expiresAt ?? null,
      };
      isAdmin.value = !!res.isAdmin;
      return isAdmin.value;
    } catch {
      currentUser.value = {
        isLoggedIn: false,
        isAdmin: false,
        role: null,
        roleMeta: null,
        username: null,
        userId: null,
        permissions: [],
        expiresAt: null,
      };
      isAdmin.value = false;
      return false;
    }
  }

  /**
   * 登录:用户名 + 密码
   * 成功:isAdmin=true,currentUser 填充
   * 失败:抛 Error(message = 后端 message),UI 自行 catch
   */
  async function login(username: string, password: string): Promise<boolean> {
    loading.value = true;
    try {
      await $fetch("/api/auth/login", {
        method: "POST",
        body: { username, password },
      });
      // 重新拉一下 /me,把 role/permissions 拿全
      await checkAuth();
      return true;
    } catch (err: any) {
      isAdmin.value = false;
      throw new Error(extractError(err, "登录失败"));
    } finally {
      loading.value = false;
    }
  }

  // 登出:通知服务端清除 cookie
  async function logout() {
    try {
      await $fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 忽略
    }
    isAdmin.value = false;
    currentUser.value = {
      isLoggedIn: false,
      isAdmin: false,
      role: null,
      roleMeta: null,
      username: null,
      userId: null,
      permissions: [],
      expiresAt: null,
    };
  }

  /** 客户端权限闸门 */
  function hasPermission(perm: Permission): boolean {
    return currentUser.value.permissions.includes(perm);
  }

  return {
    isAdmin,
    currentUser: readonly(currentUser),
    loading,
    checkAuth,
    login,
    logout,
    hasPermission,
  };
}
