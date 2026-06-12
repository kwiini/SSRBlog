/**
 * 全局 API 错误处理
 * 当管理接口返回 401 时，自动将前端 isAdmin 状态重置为 false
 */
export default defineNuxtPlugin(() => {
  const { isAdmin } = useAdminAuth();

  const originalFetch = globalThis.$fetch;

  globalThis.$fetch = async function (url: any, options: any) {
    try {
      return await originalFetch(url, options);
    } catch (err: any) {
      if (err?.statusCode === 401 && isAdmin.value) {
        isAdmin.value = false;
      }
      throw err;
    }
  } as any;
});
