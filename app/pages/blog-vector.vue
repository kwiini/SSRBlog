<template>
  <div>
    <h1 class="text-2xl font-medium text-stone-800 mb-2">博客向量化</h1>
    <p class="text-sm text-stone-500 mb-8">将博客文章转换为向量，支持语义搜索</p>

    <!-- 状态卡片 -->
    <div class="bg-white border border-stone-200/60 rounded-xl p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-medium text-stone-800">向量状态</h2>
        <span
          class="px-2 py-1 rounded-full text-xs"
          :class="stats?.exists ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
        >
          {{ stats?.exists ? '已就绪' : '未生成' }}
        </span>
      </div>

      <div v-if="stats?.exists" class="space-y-2 text-sm text-stone-600">
        <div class="flex justify-between">
          <span>文章数量</span>
          <span class="font-medium">{{ stats.articleCount }}</span>
        </div>
        <div class="flex justify-between">
          <span>Chunk 数量</span>
          <span class="font-medium">{{ stats.chunkCount }}</span>
        </div>
        <div class="flex justify-between">
          <span>最后更新</span>
          <span class="font-medium">{{ formatDate(stats.lastUpdated) }}</span>
        </div>
      </div>

      <div v-else class="text-sm text-stone-500">
        尚未生成向量数据，点击下方按钮开始
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3 mt-6">
        <button
          @click="vectorize"
          :disabled="loading.vectorize"
          class="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-700 disabled:bg-stone-300 transition-colors"
        >
          {{ loading.vectorize ? '处理中...' : stats?.exists ? '重新生成' : '开始生成' }}
        </button>
        <button
          v-if="stats?.exists"
          @click="clearVectors"
          :disabled="loading.clear"
          class="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm hover:bg-stone-50 disabled:opacity-50 transition-colors"
        >
          {{ loading.clear ? '清除中...' : '清除数据' }}
        </button>
      </div>
    </div>

    <!-- 搜索测试 -->
    <div class="bg-white border border-stone-200/60 rounded-xl p-6 mb-6">
      <h2 class="text-base font-medium text-stone-800 mb-4">语义搜索</h2>
      <div class="flex gap-3 mb-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="输入搜索关键词..."
          class="flex-1 px-4 py-2 border border-stone-200 rounded-lg text-sm focus:border-stone-400 focus:outline-none"
          @keyup.enter="search"
        />
        <button
          @click="search"
          :disabled="loading.search || !stats?.exists"
          class="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-700 disabled:bg-stone-300 transition-colors"
        >
          {{ loading.search ? '搜索中...' : '搜索' }}
        </button>
      </div>

      <!-- 搜索结果 -->
      <div v-if="searchResults.length > 0" class="space-y-3">
        <div
          v-for="(result, index) in searchResults"
          :key="result.id"
          class="border border-stone-100 rounded-lg p-4 hover:bg-stone-50 transition-colors"
        >
          <div class="flex items-start justify-between gap-4 mb-2">
            <NuxtLink
              :to="result.source"
              class="text-sm font-medium text-stone-800 hover:text-stone-600 line-clamp-1"
            >
              {{ result.metadata.title }}
            </NuxtLink>
            <span class="text-xs text-stone-400 shrink-0">
              {{ (result.similarity * 100).toFixed(1) }}%
            </span>
          </div>
          <p class="text-xs text-stone-500 line-clamp-2">
            {{ result.content }}
          </p>
        </div>
      </div>

      <div v-else-if="searched" class="text-center py-8 text-sm text-stone-400">
        未找到相关结果
      </div>
    </div>

    <!-- 文章列表 -->
    <div v-if="stats?.articles?.length" class="bg-white border border-stone-200/60 rounded-xl p-6">
      <h2 class="text-base font-medium text-stone-800 mb-4">已索引文章</h2>
      <div class="space-y-2">
        <div
          v-for="article in stats.articles"
          :key="article.path"
          class="flex justify-between items-center py-2 border-b border-stone-100 last:border-0"
        >
          <NuxtLink
            :to="article.path"
            class="text-sm text-stone-700 hover:text-stone-900 truncate"
          >
            {{ article.path }}
          </NuxtLink>
          <span class="text-xs text-stone-400">{{ article.chunks }} chunks</span>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="fixed top-20 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
      {{ error }}
      <button @click="error = ''" class="ml-3 text-stone-400 hover:text-white">✕</button>
    </div>
  </div>
</template>

<script setup>
const stats = ref(null)
const searchQuery = ref('')
const searchResults = ref([])
const searched = ref(false)
const error = ref('')

const loading = ref({
  vectorize: false,
  search: false,
  clear: false
})

// 获取统计信息
const fetchStats = async () => {
  try {
    const data = await $fetch('/api/blog-vectorize')
    stats.value = data
  } catch (err) {
    console.error('获取统计失败:', err)
  }
}

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

// 向量化
const vectorize = async () => {
  loading.value.vectorize = true
  error.value = ''

  try {
    const data = await $fetch('/api/blog-vectorize', {
      method: 'POST',
      body: { force: true }
    })
    await fetchStats()
    alert(data.message)
  } catch (err) {
    error.value = err.message || '向量化失败'
  } finally {
    loading.value.vectorize = false
  }
}

// 清除向量
const clearVectors = async () => {
  if (!confirm('确定要清除所有向量数据吗？')) return

  loading.value.clear = true
  error.value = ''

  try {
    await $fetch('/api/blog-vectorize', { method: 'DELETE' })
    await fetchStats()
    searchResults.value = []
  } catch (err) {
    error.value = err.message || '清除失败'
  } finally {
    loading.value.clear = false
  }
}

// 搜索
const search = async () => {
  if (!searchQuery.value.trim()) return

  loading.value.search = true
  error.value = ''
  searched.value = false

  try {
    const data = await $fetch('/api/blog-search', {
      query: { q: searchQuery.value, topK: '5' }
    })
    searchResults.value = data.results
    searched.value = true
  } catch (err) {
    error.value = err.message || '搜索失败'
  } finally {
    loading.value.search = false
  }
}

// 初始化
onMounted(() => {
  fetchStats()
})

useHead({ title: '博客向量化 - aissr' })
</script>
