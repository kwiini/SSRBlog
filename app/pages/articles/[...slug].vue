<template>
  <div>
    <!-- 返回按钮 -->
    <NuxtLink
      :to="backLink"
      class="inline-flex items-center text-stone-500 hover:text-stone-800 mb-8 text-sm transition-all duration-200 group"
    >
      <div
        class="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center mr-3 group-hover:bg-stone-200 transition-colors"
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
      </div>
      <span class="font-medium">返回文章列表</span>
    </NuxtLink>

    <!-- 文章卡片 -->
    <article
      class="bg-white border border-stone-200/60 rounded-2xl overflow-hidden shadow-sm mb-8"
    >
      <!-- 文章头部 - 改进设计 -->
      <div
        class="px-8 py-8 border-b border-stone-100 bg-linear-to-br from-stone-50/50 to-white"
      >
        <!-- 标签 -->
        <div
          v-if="post.meta?.tags"
          class="flex flex-wrap gap-2 mb-4"
        >
          <span
            v-for="tag in parseTags(post.meta.tags)"
            :key="tag"
            class="px-3 py-1 bg-white border border-stone-200 text-stone-600 rounded-full text-xs font-medium"
          >
            {{ tag }}
          </span>
        </div>

        <h1
          class="text-2xl md:text-3xl font-bold text-stone-800 mb-4 leading-tight"
        >
          {{ post.title }}
        </h1>

        <div class="flex flex-wrap items-center gap-5 text-sm text-stone-500">
          <div class="flex items-center">
            <div
              class="w-8 h-8 rounded-full bg-linear-to-br from-stone-700 to-stone-800 flex items-center justify-center mr-2.5"
            >
              <span class="text-xs font-semibold text-white">A</span>
            </div>
            <span class="font-medium text-stone-700">aissr</span>
          </div>
          <div class="flex items-center gap-1.5">
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {{ formatDate(post.meta?.date) }}
          </div>
          <div class="flex items-center gap-1.5">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {{ readingTime }} 分钟阅读
          </div>
        </div>
      </div>

      <!-- 文章内容 -->
      <div class="px-8">
        <ContentRenderer
          v-if="post"
          :value="post"
          class="prose prose-lg max-w-none prose-stone"
        />
      </div>

      <!-- 文章底部 - 改进设计 -->
      <div class="px-8 py-6 border-t border-stone-100 bg-stone-50/50">
        <div class="flex items-center justify-between">
          <NuxtLink
            :to="backLink"
            class="inline-flex items-center text-sm text-stone-600 hover:text-stone-900 transition-colors group"
          >
            <div
              class="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center mr-2.5 group-hover:border-stone-300 transition-colors"
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
            </div>
            <span class="font-medium">返回文章列表</span>
          </NuxtLink>

          <!-- 分享按钮 -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-stone-400 mr-1">分享</span>
            <button
              @click="copyLink"
              class="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center hover:border-stone-300 hover:bg-stone-50 transition-all"
              title="复制链接"
            >
              <svg
                class="w-4 h-4 text-stone-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>

    <!-- 相关文章推荐 -->
    <Transition name="fade">
      <div
        v-if="relatedPosts.length > 0"
        class="bg-white border border-stone-200/60 rounded-2xl p-6 shadow-sm"
      >
        <div class="flex items-center gap-3 mb-5">
          <div
            class="w-10 h-10 rounded-xl bg-linear-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm"
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
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-semibold text-stone-800">相关文章</h2>
            <p class="text-xs text-stone-500">基于内容相似度推荐</p>
          </div>
        </div>

        <div class="space-y-3">
          <NuxtLink
            v-for="(related, index) in relatedPosts"
            :key="related.path"
            :to="related.path"
            class="block p-4 rounded-xl border border-stone-100 hover:border-stone-200 hover:bg-stone-50/50 transition-all duration-200 group"
            :style="{ animationDelay: `${index * 100}ms` }"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <h3
                  class="text-sm font-semibold text-stone-800 mb-1 group-hover:text-emerald-600 transition-colors line-clamp-1"
                >
                  {{ related.title }}
                </h3>
                <p
                  v-if="related.description"
                  class="text-xs text-stone-500 line-clamp-2 leading-relaxed"
                >
                  {{ related.description }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div
                  class="flex items-center gap-1 px-2 py-1 bg-stone-100 rounded-lg"
                >
                  <svg
                    class="w-3 h-3 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m16.94 0l-.707.707"
                    />
                  </svg>
                  <span class="text-xs font-medium text-stone-600"
                    >{{ (related.similarity * 100).toFixed(0) }}%</span
                  >
                </div>
                <svg
                  class="w-4 h-4 text-stone-300 group-hover:text-stone-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </Transition>

    <!-- 复制成功提示 -->
    <Transition name="toast">
      <div
        v-if="showToast"
        class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-5 py-3 rounded-xl text-sm shadow-lg flex items-center gap-2"
      >
        <svg
          class="w-4 h-4 text-emerald-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        链接已复制
      </div>
    </Transition>
  </div>
</template>

<script setup>
const route = useRoute();
const slug = computed(() => route.params.slug); // 文章路径
const showToast = ref(false); // 是否显示复制成功提示
const relatedPosts = ref([]); // 相关文章列表

const { data: post } = await useAsyncData(
  () => `post-${slug.value}`,
  () => {
    return queryCollection("content").path(`/articles/${slug.value}`).first();
  },
  {
    watch: [slug],
  },
);

// 获取相关文章
const fetchRelatedPosts = async () => {
  if (!post.value?.path) return;

  try {
    const { data } = await $fetch("/api/related-posts", {
      query: {
        path: post.value.path,
        topK: "3",
      },
    });
    relatedPosts.value = data || [];
  } catch (err) {
    // console.error("获取相关文章失败:", err);
    relatedPosts.value = [];
  }
};

// 监听文章变化，自动获取相关文章
watch(
  () => post.value?.path,
  (newPath) => {
    if (newPath) {
      fetchRelatedPosts();
    }
  },
  { immediate: true },
);

// 计算阅读时间
const readingTime = computed(() => {
  if (!post.value?.body?.value) return 1;
  const text = JSON.stringify(post.value.body.value);
  const words = text.length / 2;
  return Math.max(1, Math.ceil(words / 300));
});

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// 解析标签
const parseTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") return tags.split(",").map((t) => t.trim());
  return [];
};

// 复制链接
const copyLink = () => {
  navigator.clipboard.writeText(window.location.href);
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 2000);
};

// 返回列表页时保留页码
const backLink = computed(() => {
  // 从浏览器 history state 中获取来源页码
  const state = history.state;
  if (state?.back) {
    const backUrl = new URL(state.back, window.location.origin);
    const page = backUrl.searchParams.get('page');
    if (page) return `/?page=${page}`;
  }
  return '/';
});

useHead(() => ({
  title: post.value?.title ? `${post.value.title} - aissr` : "文章 - aissr",
  meta: [
    {
      name: "description",
      content: post.value?.description || "aissr 文章详情",
    },
  ],
}));
</script>

<style scoped>
/* Toast 动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

/* 淡入动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.4s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 文章内容样式增强 */
:deep(.prose) {
  color: #44403c;
}

:deep(.prose h1) {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1c1917;
  margin-bottom: 1.25rem;
  margin-top: 2.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e7e5e4;
}

:deep(.prose h2) {
  font-size: 1.5rem;
  font-weight: 600;
  color: #292524;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.prose h3) {
  font-size: 1.25rem;
  font-weight: 600;
  color: #44403c;
  margin-bottom: 0.75rem;
  margin-top: 1.5rem;
}

:deep(.prose p) {
  margin-bottom: 1.25rem;
  line-height: 1.8;
}

:deep(.prose ul) {
  margin-bottom: 1.25rem;
  padding-left: 1.5rem;
}

:deep(.prose ol) {
  margin-bottom: 1.25rem;
  padding-left: 1.5rem;
}

:deep(.prose li) {
  margin-bottom: 0.5rem;
}

:deep(.prose a) {
  color: #059669;
  text-decoration: none;
  border-bottom: 1px solid #d1fae5;
  transition: all 0.2s;
}

:deep(.prose a:hover) {
  color: #047857;
  border-bottom-color: #059669;
}

:deep(.prose code) {
  background-color: #f5f5f4;
  padding: 0.2rem 0.4rem;
  border-radius: 0.375rem;
  font-size: 0.875em;
  color: #44403c;
}

:deep(.prose pre) {
  background-color: #f5f5f4;
  padding: 1.25rem;
  border-radius: 0.75rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
}

:deep(.prose pre code) {
  background-color: transparent;
  padding: 0;
  font-size: 0.875rem;
}

:deep(.prose blockquote) {
  border-left: 4px solid #d6d3d1;
  padding-left: 1.25rem;
  margin-left: 0;
  margin-bottom: 1.5rem;
  color: #78716c;
  font-style: italic;
}

:deep(.prose img) {
  border-radius: 0.75rem;
  margin: 2rem 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

:deep(.prose table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
  font-size: 0.9375rem;
}

:deep(.prose th) {
  background-color: #f5f5f4;
  font-weight: 600;
  color: #1c1917;
}

:deep(.prose th),
:deep(.prose td) {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #e7e5e4;
}

:deep(.prose tr:hover) {
  background-color: #fafaf9;
}
</style>
