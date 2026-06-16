<template>
  <div class="min-h-screen bg-stone-50 text-stone-800 font-sans flex flex-col">
    <!-- 导航栏 -->
    <nav
      class="bg-white/70 backdrop-blur-sm border-b border-stone-200/60 sticky top-0 z-50 shrink-0"
    >
      <div class="max-w-5xl mx-auto px-6">
        <div class="flex justify-between items-center h-14">
          <!-- Logo -->
          <NuxtLink
            to="/"
            class="flex items-center gap-2.5 group"
          >
            <CurataLogo size="sm" />
            <span
              class="text-lg font-medium text-stone-700 group-hover:text-stone-900 transition-colors"
            >
              Curata
            </span>
          </NuxtLink>

          <!-- 导航链接 -->
          <div class="flex items-center gap-1">
            <NuxtLink
              to="/"
              class="px-3 py-1.5 rounded-md text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition-all"
              :class="{ 'bg-stone-100 text-stone-900': $route.path === '/' }"
            >
              文章
            </NuxtLink>
            <NuxtLink
              to="/chat"
              class="px-3 py-1.5 rounded-md text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition-all"
              :class="{
                'bg-stone-100 text-stone-900': $route.path === '/chat',
              }"
            >
              知识库
            </NuxtLink>
            <NuxtLink
              to="/literature-review"
              class="px-3 py-1.5 rounded-md text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition-all"
              :class="{
                'bg-stone-100 text-stone-900': $route.path === '/literature-review',
              }"
            >
              文献综述
            </NuxtLink>

            <!-- 管理员专属链接 -->
            <template v-if="isAdmin">
              <NuxtLink
                to="/blog-vector"
                class="px-3 py-1.5 rounded-md text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition-all"
                :class="{
                  'bg-stone-100 text-stone-900': $route.path === '/blog-vector',
                }"
              >
                向量化
              </NuxtLink>
              <NuxtLink
                to="/admin"
                class="px-3 py-1.5 rounded-md text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition-all"
                :class="{
                  'bg-stone-100 text-stone-900': $route.path.startsWith('/admin'),
                }"
              >
                文章管理
              </NuxtLink>
            </template>
          </div>

          <!-- 管理员登录/登出 -->
          <div class="flex items-center gap-2 ml-4">
            <template v-if="isAdmin">
              <span class="text-xs text-stone-500">已登录</span>
              <button
                @click="handleLogout"
                class="px-3 py-1.5 rounded-md text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all"
              >
                退出
              </button>
            </template>
            <button
              v-else
              @click="showLoginModal = true"
              class="px-3 py-1.5 rounded-md text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all"
            >
              管理员
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- 登录模态框 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showLoginModal"
          class="fixed inset-0 z-100 flex items-center justify-center p-4"
          @click.self="showLoginModal = false"
        >
          <div class="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" @click="showLoginModal = false"></div>
          <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 class="text-lg font-semibold text-stone-800 mb-4">管理员登录</h3>
            <div class="flex flex-col gap-3">
              <input
                v-model="username"
                type="text"
                placeholder="用户名"
                :disabled="loginLoading"
                autocomplete="username"
                class="px-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                @keyup.enter="focusPassword"
              />
              <input
                ref="passwordInput"
                v-model="password"
                type="password"
                placeholder="输入密码"
                :disabled="loginLoading"
                autocomplete="current-password"
                class="px-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                @keyup.enter="handleLogin"
              />
              <button
                @click="handleLogin"
                :disabled="loginLoading"
                class="px-5 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {{ loginLoading ? '登录中...' : '登录' }}
              </button>
            </div>
            <p v-if="loginError" class="text-xs text-red-500 mt-2">{{ loginError }}</p>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 主内容区 -->
    <main class="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
      <slot />
    </main>

    <!-- 页脚 -->
    <footer class="border-t border-stone-200/60 bg-stone-50 shrink-0">
      <div class="max-w-5xl mx-auto px-6 py-6">
        <div class="flex justify-between items-center text-sm text-stone-500">
          <p>© 2026 Curata</p>
          <a
            href="https://github.com/kwiini"
            target="_blank"
            class="hover:text-stone-700 transition-colors"
          >
            <svg
              class="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
              />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { isAdmin, currentUser, checkAuth, login, logout, hasPermission } = useAdminAuth();
const { mode, toggle: toggleColorMode } = useColorMode();

const showLoginModal = ref(false); // 登录模态框是否显示
const username = ref(''); // 用户名输入框
const password = ref(''); // 密码输入框
const loginError = ref(''); // 登录错误提示
const loginLoading = ref(false); // 登录中
const passwordInput = ref<HTMLInputElement | null>(null); // 密码框 ref(用户输入完用户名后回车自动聚焦)

// 页面加载时向服务端确认登录状态
onMounted(() => {
  checkAuth();
});

// 用户名框回车后,自动聚焦到密码框
function focusPassword() {
  passwordInput.value?.focus();
}

/**
 * 处理登录
 */
async function handleLogin() {
  if (!username.value) {
    loginError.value = '请输入用户名';
    return;
  }
  if (!password.value) {
    loginError.value = '请输入密码';
    return;
  }
  loginLoading.value = true;
  loginError.value = '';
  try {
    const success = await login(username.value, password.value);
    if (success) {
      showLoginModal.value = false;
      username.value = '';
      password.value = '';
    } else {
      loginError.value = '登录失败';
    }
  } catch (err: any) {
    // useAdminAuth.login 失败时抛 Error(message = 后端 message)
    loginError.value = err?.message || '登录失败，请重试';
  } finally {
    loginLoading.value = false;
  }
}

/**
 * 处理登出
 */
async function handleLogout() {
  await logout();
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
