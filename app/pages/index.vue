<template>
  <div>
    <!-- 简洁标题区 -->
    <div class="mb-10">
      <h1 class="text-2xl font-medium text-stone-800 mb-2">
        文章
      </h1>
      <p class="text-sm text-stone-500">
        关于技术与生活的思考
      </p>
    </div>
    
    <!-- 文章列表 -->
    <div class="space-y-4">
      <article
        v-for="post in posts"
        :key="post.path"
        class="group"
      >
        <NuxtLink :to="post.path" class="block">
          <div class="bg-white border border-stone-200/60 rounded-xl p-5 hover:border-stone-300 hover:shadow-sm transition-all">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <h3 class="text-base font-medium text-stone-800 mb-2 group-hover:text-stone-600 transition-colors line-clamp-1">
                  {{ post.title }}
                </h3>
                <p class="text-sm text-stone-500 line-clamp-2 leading-relaxed">
                  {{ post.description || '暂无描述' }}
                </p>
              </div>
              <div class="flex items-center text-xs text-stone-400 shrink-0">
                <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                {{ formatDate(post.meta?.date) }}
              </div>
            </div>
          </div>
        </NuxtLink>
      </article>
    </div>
    
    <!-- 空状态 -->
    <div v-if="!posts || posts.length === 0" class="text-center py-20">
      <div class="w-14 h-14 bg-stone-100 rounded-xl flex items-center justify-center mx-auto mb-4">
        <svg class="w-7 h-7 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
      </div>
      <h3 class="text-base font-medium text-stone-700 mb-1">暂无文章</h3>
      <p class="text-sm text-stone-500">敬请期待</p>
    </div>
  </div>
</template>

<script setup>
useHead({
  title: 'aissr',
  meta: [
    { name: 'description', content: 'aissr - 关于技术与生活的思考' }
  ]
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

const { data: posts } = await useAsyncData('posts', () => {
  return queryCollection('content').all()
})
</script>
