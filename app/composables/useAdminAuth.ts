/**
 * 管理员认证状态管理
 */
export function useAdminAuth() {
  const isAdmin = useState('admin-auth', () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('admin-auth') === 'true';
  });

  function login(password: string): boolean {
    const config = useRuntimeConfig();
    const adminPassword = (config.public.adminPassword as string) || 'admin123';
    if (password === adminPassword) {
      isAdmin.value = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin-auth', 'true');
      }
      return true;
    }
    return false;
  }

  /**
   * 退出管理员认证
   */
  /**
   * 管理员登出
   */
  function logout() {
    isAdmin.value = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin-auth');
    }
  }

  return { isAdmin, login, logout };
}
