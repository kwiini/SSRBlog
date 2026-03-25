<template>
  <div>
    <!-- 返回按钮 -->
    <NuxtLink to="/" class="inline-flex items-center text-stone-500 hover:text-stone-800 mb-6 text-sm transition-colors">
      <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
      </svg>
      返回
    </NuxtLink>
    
    <!-- 文章 -->
    <article class="bg-white border border-stone-200/60 rounded-xl overflow-hidden">
      <!-- 文章头部 -->
      <div class="px-6 py-5 border-b border-stone-100">
        <h1 class="text-xl font-medium text-stone-800 mb-3">
          {{ post.title }}
        </h1>
        <div class="flex items-center gap-4 text-xs text-stone-500">
          <div class="flex items-center">
            <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            {{ formatDate(post.meta?.date) }}
          </div>
          <div class="flex items-center">
            <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {{ readingTime }} 分钟阅读
          </div>
        </div>
      </div>
      
      <!-- 文章内容 -->
      <div class="px-6 py-1">
        <ContentRenderer v-if="post" :value="post" class="prose max-w-none" />
      </div>
      
      <!-- 文章底部 -->
      <div class="px-6 py-4 border-t border-stone-100 bg-stone-50/50">
        <NuxtLink to="/" class="inline-flex items-center text-sm text-stone-600 hover:text-stone-900 transition-colors">
          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          返回文章列表
        </NuxtLink>
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

// 计算阅读时间
const readingTime = computed(() => {
  if (!post.value?.body?.value) return 1
  const text = JSON.stringify(post.value.body.value)
  const words = text.length / 2 // 估算中文字数
  return Math.max(1, Math.ceil(words / 300))
})

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

useHead(() => ({
  title: post.value?.title ? `${post.value.title} - aissr` : '文章 - aissr',
  meta: [
    { name: 'description', content: post.value?.description || 'aissr 文章详情' }
  ]
}))
</script>
