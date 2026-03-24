<template>
  <div class="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
    <!-- 简洁导航栏 -->
    <nav class="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center space-x-2 group">
            <div class="w-8 h-8 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-sm">A</span>
            </div>
            <span class="text-xl font-bold bg-linear-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-purple-600 transition-all">
              AISSR Blog
            </span>
          </NuxtLink>
          
          <!-- 导航链接 -->
          <div class="flex items-center space-x-1">
            <NuxtLink 
              to="/" 
              class="px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
              :class="{ 'bg-gray-100 text-gray-900': $route.path === '/' }"
            >
              首页
            </NuxtLink>
            <NuxtLink 
              to="/ssr-test" 
              class="px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
              :class="{ 'bg-gray-100 text-gray-900': $route.path === '/ssr-test' }"
            >
              SSR测试
            </NuxtLink>
          </div>
        </div>
      </div>
    </nav>
    
    <!-- 主内容区 -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <NuxtPage />
    </main>
    
    <!-- 页脚 -->
    <footer class="bg-white border-t border-gray-200 mt-auto">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex justify-between items-center">
          <p class="text-gray-500 text-sm">
            © 2026 AISSR Blog. Built with Nuxt.js & Tailwind CSS.
          </p>
          <div class="flex space-x-4">
            <a href="https://github.com" target="_blank" class="text-gray-400 hover:text-gray-600 transition-colors">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
