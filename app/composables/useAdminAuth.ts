/**
 * 管理员认证状态管理
 * - 登录：POST /api/auth/login → 服务端校验密码 → httpOnly cookie 自动写入
 * - 状态：GET /api/auth/me → 服务端验证 cookie 中的 JWT
 * - 登出：POST /api/auth/logout → 清除 cookie
 * - 前端不再存储密码，不再信任 localStorage
 */
export function useAdminAuth() {
  const isAdmin = useState("admin-auth", () => false);
  const loading = ref(false);

  // 页面加载时向服务端确认登录状态
  async function checkAuth(): Promise<boolean> {
    try {
      const res: any = await $fetch("/api/auth/me");
      isAdmin.value = res.isAdmin === true;
      return isAdmin.value;
    } catch {
      isAdmin.value = false;
      return false;
    }
  }

  // 登录：密码发给服务端校验
  async function login(password: string): Promise<boolean> {
    loading.value = true;
    try {
      await $fetch("/api/auth/login", {
        method: "POST",
        body: { password },
      });
      isAdmin.value = true;
      return true;
    } catch {
      isAdmin.value = false;
      return false;
    } finally {
      loading.value = false;
    }
  }

  // 登出：通知服务端清除 cookie
  async function logout() {
    try {
      await $fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 忽略
    }
    isAdmin.value = false;
  }

  return { isAdmin, loading, checkAuth, login, logout };
}
