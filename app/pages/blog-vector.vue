<template>
  <div>
    <!-- 标题 -->
    <div class="mb-10">
      <div class="flex items-center gap-3 mb-3">
        <div
          class="w-1 h-6 bg-linear-to-b from-stone-700 to-stone-500 rounded-full"
        ></div>
        <h1 class="text-2xl font-semibold text-stone-800">博客向量化</h1>
      </div>
      <p class="text-sm text-stone-500 ml-4">
        将博客文章转换为向量，支持语义搜索和智能问答
      </p>
    </div>

    <!-- 状态卡片 -->
    <div
      class="bg-white border border-stone-200/60 rounded-2xl p-6 mb-6 shadow-sm"
    >
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm"
          >
            <svg
              class="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-stone-800">向量状态</h2>
            <p class="text-xs text-stone-500">知识库数据状态</p>
          </div>
        </div>
        <span
          class="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
          :class="
            stats?.exists
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          "
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="stats?.exists ? 'bg-emerald-500' : 'bg-amber-500'"
          ></span>
          {{ stats?.exists ? "已就绪" : "未生成" }}
        </span>
      </div>

      <div
        v-if="stats?.exists"
        class="grid grid-cols-3 gap-4 mb-6"
      >
        <div class="bg-stone-50 rounded-xl p-4 text-center">
          <p class="text-2xl font-bold text-stone-800">
            {{ stats.articleCount }}
          </p>
          <p class="text-xs text-stone-500 mt-1">文章数量</p>
        </div>
        <div class="bg-stone-50 rounded-xl p-4 text-center">
          <p class="text-2xl font-bold text-stone-800">
            {{ stats.chunkCount }}
          </p>
          <p class="text-xs text-stone-500 mt-1">Chunk 数量</p>
        </div>
        <div class="bg-stone-50 rounded-xl p-4 text-center">
          <p class="text-sm font-semibold text-stone-700 mt-1">
            {{ formatDate(stats.lastUpdated) }}
          </p>
          <p class="text-xs text-stone-500 mt-1">最后更新</p>
        </div>
      </div>

      <div
        v-else
        class="bg-stone-50 rounded-xl p-6 text-center mb-6"
      >
        <div
          class="w-12 h-12 bg-stone-200 rounded-xl flex items-center justify-center mx-auto mb-3"
        >
          <svg
            class="w-6 h-6 text-stone-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <p class="text-sm text-stone-500">尚未生成向量数据，点击下方按钮开始</p>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3">
        <button
          @click="vectorize"
          :disabled="loading.vectorize"
          class="flex-1 px-5 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 disabled:bg-stone-300 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          <svg
            v-if="loading.vectorize"
            class="w-4 h-4 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <svg
            v-else
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {{
            loading.vectorize
              ? "处理中..."
              : stats?.exists
                ? "重新生成"
                : "开始生成"
          }}
        </button>
        <button
          v-if="stats?.exists"
          @click="clearVectors"
          :disabled="loading.clear"
          class="px-5 py-2.5 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-50 disabled:opacity-50 transition-all duration-200 flex items-center gap-2 active:scale-[0.98]"
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
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          {{ loading.clear ? "清除中..." : "清除数据" }}
        </button>
      </div>
    </div>

    <!-- 搜索测试 -->
    <div
      class="bg-white border border-stone-200/60 rounded-2xl p-6 mb-6 shadow-sm"
    >
      <div class="flex items-center gap-3 mb-5">
        <div
          class="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm"
        >
          <svg
            class="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <div>
          <h2 class="text-base font-semibold text-stone-800">语义搜索</h2>
          <p class="text-xs text-stone-500">测试向量搜索功能</p>
        </div>
      </div>

      <div class="relative mb-5">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="输入搜索关键词..."
          class="w-full px-4 py-3 pr-24 border border-stone-200 rounded-xl text-sm focus:border-stone-400 focus:outline-none focus:shadow-lg focus:shadow-stone-100 transition-all"
          @keyup.enter="search"
          :disabled="!stats?.exists"
        />
        <button
          @click="search"
          :disabled="loading.search || !stats?.exists"
          class="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-700 disabled:bg-stone-200 transition-all duration-200 flex items-center gap-1.5"
        >
          <svg
            v-if="loading.search"
            class="w-3.5 h-3.5 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <svg
            v-else
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {{ loading.search ? "搜索中..." : "搜索" }}
        </button>
      </div>

      <!-- 搜索结果 -->
      <Transition name="fade">
        <div
          v-if="searchResults.length > 0"
          class="space-y-3"
        >
          <div
            v-for="(result, index) in searchResults"
            :key="result.id"
            class="border border-stone-100 rounded-xl p-4 hover:border-stone-200 hover:bg-stone-50/50 transition-all duration-200 group fade-item"
            :style="{ animationDelay: `${index * 50}ms` }"
          >
            <div class="flex items-start justify-between gap-4 mb-2">
              <NuxtLink
                :to="result.source"
                class="text-sm font-semibold text-stone-800 hover:text-emerald-600 transition-colors line-clamp-1 flex items-center gap-2"
              >
                <svg
                  class="w-4 h-4 text-stone-400"
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
                {{ result.metadata.title }}
              </NuxtLink>
              <span
                class="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0"
              >
                {{ (result.similarity * 100).toFixed(1) }}%
              </span>
            </div>
            <p class="text-xs text-stone-500 line-clamp-2 leading-relaxed">
              {{ result.content }}
            </p>
          </div>
        </div>
      </Transition>

      <Transition name="fade">
        <div
          v-if="searched && searchResults.length === 0"
          class="text-center py-10"
        >
          <div
            class="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center mx-auto mb-3"
          >
            <svg
              class="w-6 h-6 text-stone-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p class="text-sm text-stone-500">未找到相关结果</p>
        </div>
      </Transition>
    </div>

    <!-- 文章列表 -->
    <Transition name="fade">
      <div
        v-if="stats?.articles?.length"
        class="bg-white border border-stone-200/60 rounded-2xl p-6 shadow-sm"
      >
        <div class="flex items-center gap-3 mb-5">
          <div
            class="w-10 h-10 rounded-xl bg-linear-to-br from-stone-600 to-stone-700 flex items-center justify-center shadow-sm"
          >
            <svg
              class="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-stone-800">已索引文章</h2>
            <p class="text-xs text-stone-500">
              共 {{ stats.articles.length }} 篇文章
            </p>
          </div>
        </div>

        <div class="space-y-2 max-h-64 overflow-y-auto pr-2">
          <div
            v-for="(article, index) in stats.articles"
            :key="article.path"
            class="flex justify-between items-center py-3 px-3 rounded-lg border border-stone-100 hover:border-stone-200 hover:bg-stone-50 transition-all fade-item"
            :style="{ animationDelay: `${index * 30}ms` }"
          >
            <NuxtLink
              :to="article.path"
              class="text-sm text-stone-700 hover:text-stone-900 truncate flex items-center gap-2 flex-1 mr-4"
            >
              <span
                class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
              ></span>
              {{ article.path.replace("/articles/", "") }}
            </NuxtLink>
            <span
              class="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full shrink-0"
            >
              {{ article.chunks }} chunks
            </span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 错误提示 -->
    <Transition name="toast">
      <div
        v-if="error"
        class="fixed top-20 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-5 py-3 rounded-xl text-sm shadow-lg flex items-center gap-3"
      >
        <svg
          class="w-4 h-4 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {{ error }}
        <button
          @click="error = ''"
          class="ml-2 text-stone-400 hover:text-white transition-colors"
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
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
const stats = ref(null); // 向量状态信息
const searchQuery = ref(""); // 搜索查询
const searchResults = ref([]); // 搜索结果
const searched = ref(false); // 是否已搜索
const error = ref(""); // 错误信息

const loading = ref({
  vectorize: false, // 向量化加载状态
  search: false, // 搜索加载状态
  clear: false, // 清除加载状态
});

// 获取统计信息
const fetchStats = async () => {
  const data = await $fetch("/api/blog/vectorize");
  stats.value = data;
};

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 向量化
const vectorize = async () => {
  loading.value.vectorize = true;
  error.value = "";

  try {
    const data = await $fetch("/api/blog/vectorize", {
      method: "POST",
      body: { force: true },
    });
    await fetchStats();
  } catch (err) {
    error.value = err.message || "向量化失败";
  } finally {
    loading.value.vectorize = false;
  }
};

// 清除向量
const clearVectors = async () => {
  if (!confirm("确定要清除所有向量数据吗？")) return;

  loading.value.clear = true;
  error.value = "";

  try {
    await $fetch("/api/blog/vectorize", { method: "DELETE" });
    await fetchStats();
    searchResults.value = [];
    searched.value = false;
  } catch (err) {
    error.value = err.message || "清除失败";
  } finally {
    loading.value.clear = false;
  }
};

// 搜索
const search = async () => {
  if (!searchQuery.value.trim()) return;

  loading.value.search = true;
  error.value = "";
  searched.value = false;

  try {
    const data = await $fetch("/api/blog/search", {
      query: { q: searchQuery.value, topK: "5" },
    });
    searchResults.value = data.results;
    searched.value = true;
  } catch (err) {
    error.value = err.message || "搜索失败";
  } finally {
    loading.value.search = false;
  }
};

// 初始化
onMounted(() => {
  fetchStats();
});

useHead({ title: "博客向量化 - Curata" });
</script>

<style scoped>
/* 淡入动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

/* 列表项淡入 */
.fade-item {
  animation: fadeItemIn 0.4s ease both;
}

@keyframes fadeItemIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d6d3d1;
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a29e;
}
</style>
