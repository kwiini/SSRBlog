<template>
  <div>
    <!-- 页面标题 -->
    <div class="text-center mb-12">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">
        探索技术的无限可能
      </h1>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto">
        分享关于 Nuxt.js、Vue.js 和前端开发的思考与实践
      </p>
    </div>
    
    <!-- 文章卡片网格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <article
        v-for="post in posts"
        :key="post.path"
        class="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
      >
        <NuxtLink :to="post.path" class="block h-full">
          <!-- 卡片头部 - 渐变背景 -->
          <div class="h-32 bg-linear-to-br from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
            <div class="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
            <div class="absolute bottom-4 left-4 right-4">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-700 backdrop-blur-sm">
                技术文章
              </span>
            </div>
          </div>
          
          <!-- 卡片内容 -->
          <div class="p-6">
            <h3 class="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
              {{ post.title }}
            </h3>
            <p class="text-gray-600 mb-4 line-clamp-3 text-sm leading-relaxed">
              {{ post.description || '暂无描述' }}
            </p>
            
            <!-- 卡片底部信息 -->
            <div class="flex items-center justify-between pt-4 border-t border-gray-100">
              <div class="flex items-center text-sm text-gray-500">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                {{ post.meta?.date || '未知日期' }}
              </div>
              <span class="text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform flex items-center">
                阅读更多
                <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </span>
            </div>
          </div>
        </NuxtLink>
      </article>
    </div>
    
    <!-- 空状态 -->
    <div v-if="!posts || posts.length === 0" class="text-center py-16">
      <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">暂无文章</h3>
      <p class="text-gray-500">敬请期待更多精彩内容</p>
    </div>
  </div>
</template>

<script setup>
// SEO 优化
useHead({
  title: 'AISSR Blog - 首页',
  meta: [
    { name: 'description', content: 'AISSR Blog - 一个使用 Nuxt.js 和 Tailwind CSS 构建的个人博客' },
    { name: 'keywords', content: '博客, Nuxt.js, Tailwind CSS, Vue.js' },
    { property: 'og:title', content: 'AISSR Blog - 首页' },
    { property: 'og:description', content: 'AISSR Blog - 一个使用 Nuxt.js 和 Tailwind CSS 构建的个人博客' },
    { property: 'og:type', content: 'website' }
  ]
})

const { data: posts } = await useAsyncData('posts', () => {
  return queryCollection('content').all()
})
</script>