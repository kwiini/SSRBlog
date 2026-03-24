<template>
  <div class="max-w-4xl mx-auto">
    <!-- 返回按钮 -->
    <NuxtLink to="/" class="inline-flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
      </svg>
      返回文章列表
    </NuxtLink>
    
    <!-- 文章卡片 -->
    <article class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <!-- 文章头部 - 渐变背景 -->
      <div class="h-48 bg-linear-to-br from-blue-500 via-purple-500 to-pink-500 relative">
        <div class="absolute inset-0 bg-black/20"></div>
        <div class="absolute bottom-0 left-0 right-0 p-8">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-700 backdrop-blur-sm mb-4">
            技术文章
          </span>
          <h1 class="text-3xl md:text-4xl font-bold text-white mb-2">
            {{ post.title }}
          </h1>
        </div>
      </div>
      
      <!-- 文章元信息 -->
      <div class="px-8 py-4 border-b border-gray-100 bg-gray-50/50">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="flex items-center space-x-4 text-sm text-gray-500">
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              {{ post.meta?.date || '未知日期' }}
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              阅读时间约 5 分钟
            </div>
          </div>
          
          <!-- 分享按钮 -->
          <div class="flex items-center space-x-2">
            <button class="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="复制链接">
              <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <!-- 文章内容 -->
      <div class="p-8">
        <ContentRenderer v-if="post" :value="post" class="prose max-w-none" />
      </div>
      
      <!-- 文章底部 -->
      <div class="px-8 py-6 border-t border-gray-100 bg-gray-50/50">
        <div class="flex items-center justify-between">
          <NuxtLink to="/" class="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            返回文章列表
          </NuxtLink>
          
          <div class="text-sm text-gray-500">
            感谢阅读！
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup>
const route = useRoute()
const slug = route.params.slug

const { data: post } = await useAsyncData('post', () => {
  return queryCollection('content').path(`/articles/${slug}`).first()
})

// SEO 优化 - 动态 title 和 meta
useHead(() => ({
  title: post.value?.title ? `${post.value.title} - AISSR Blog` : '文章详情 - AISSR Blog',
  meta: [
    { name: 'description', content: post.value?.description || 'AISSR Blog 文章详情' },
    { name: 'keywords', content: '博客, Nuxt.js, Tailwind CSS, Vue.js' },
    { property: 'og:title', content: post.value?.title || '文章详情' },
    { property: 'og:description', content: post.value?.description || 'AISSR Blog 文章详情' },
    { property: 'og:type', content: 'article' },
    { property: 'article:published_time', content: post.value?.meta?.date }
  ]
}))
</script>