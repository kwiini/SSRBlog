/**
 * 暗色模式管理
 * - 默认跟随系统偏好 (prefers-color-scheme: dark)
 * - 用户手动切换后保存到 localStorage
 * - 通过给 <html> 切换 .dark 类驱动 Tailwind 的 dark: 变体
 */
export function useColorMode() {
  const mode = useState<'light' | 'dark'>('color-mode', () => 'light')

  // 客户端初始化:localStorage 优先,其次系统偏好
  if (import.meta.client) {
    const stored = localStorage.getItem('color-mode')
    if (stored === 'light' || stored === 'dark') {
      mode.value = stored
    } else {
      mode.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.documentElement.classList.toggle('dark', mode.value === 'dark')
  }

  function setMode(value: 'light' | 'dark') {
    mode.value = value
    if (import.meta.client) {
      localStorage.setItem('color-mode', value)
      document.documentElement.classList.toggle('dark', value === 'dark')
    }
  }

  function toggle() {
    setMode(mode.value === 'dark' ? 'light' : 'dark')
  }

  return { mode, setMode, toggle }
}
