<template>
  <div class="min-h-screen bg-stone-50">
    <!-- 后台导航栏 -->
    <nav class="bg-white border-b border-stone-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-6">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 bg-linear-to-br from-stone-700 to-stone-900 rounded-lg flex items-center justify-center"
            >
              <span class="text-white font-semibold text-sm">A</span>
            </div>
            <span class="text-lg font-semibold text-stone-800">管理后台</span>
          </div>

          <!-- 导航链接 -->
          <div class="flex items-center gap-1">
            <NuxtLink
              to="/admin"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              :class="
                $route.path === '/admin'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              "
            >
              <span class="flex items-center gap-2">
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                文章管理
              </span>
            </NuxtLink>
            <NuxtLink
              to="/admin/write"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              :class="
                $route.path === '/admin/write'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              "
            >
              <span class="flex items-center gap-2">
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                写文章
              </span>
            </NuxtLink>
          </div>

          <!-- 返回前台 -->
          <NuxtLink
            to="/"
            class="flex items-center gap-2 px-4 py-2 text-sm text-stone-600 hover:text-stone-900 transition-colors"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            返回前台
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- 主内容区 -->
    <main class="max-w-7xl mx-auto px-6 py-8">
      <slot />
    </main>
  </div>
</template>
