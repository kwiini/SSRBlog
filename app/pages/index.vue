<template>
  <div>
    <!-- 标题区 -->
    <div class="mb-12">
      <div class="flex items-center gap-3 mb-3">
        <div
          class="w-1 h-6 bg-linear-to-b from-stone-700 to-stone-500 rounded-full"
        ></div>
        <h1 class="text-2xl font-semibold text-stone-800">文章</h1>
      </div>
      <p class="text-sm text-stone-500 ml-4">
        关于技术与生活的思考，记录学习与成长的点滴
      </p>
    </div>

    <!-- 文章列表 -->
    <div class="space-y-5">
      <article
        v-for="(post, index) in paginatedPosts"
        :key="post.path"
        class="group"
        :style="{ animationDelay: `${index * 50}ms` }"
      >
        <NuxtLink
          :to="post.path"
          class="block"
        >
          <div
            class="bg-white border border-stone-200/60 rounded-2xl p-6 hover:border-stone-300 hover:shadow-lg hover:shadow-stone-200/50 transition-all duration-300 transform hover:-translate-y-0.5"
          >
            <div class="flex items-start justify-between gap-5">
              <div class="flex-1 min-w-0">
                <!-- 标签 -->
                <div
                  v-if="post.meta?.tags"
                  class="flex flex-wrap gap-2 mb-3"
                >
                  <span
                    v-for="tag in parseTags(post.meta.tags)"
                    :key="tag"
                    class="px-2.5 py-0.5 bg-stone-100 text-stone-600 rounded-full text-xs font-medium"
                  >
                    {{ tag }}
                  </span>
                </div>

                <h3
                  class="text-lg font-semibold text-stone-800 mb-2 group-hover:text-stone-600 transition-colors line-clamp-1"
                >
                  {{ post.title }}
                </h3>
                <p
                  class="text-sm text-stone-500 line-clamp-2 leading-relaxed mb-3"
                >
                  {{ post.description || "暂无描述" }}
                </p>

                <!-- 元信息 -->
                <div class="flex items-center gap-4 text-xs text-stone-400">
                  <span class="flex items-center gap-1.5">
                    <svg
                      class="w-3.5 h-3.5"
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
                  </span>
                  <span class="flex items-center gap-1.5">
                    <svg
                      class="w-3.5 h-3.5"
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
                    {{ getReadingTime(post.body) }} 分钟阅读
                  </span>
                </div>
              </div>

              <!-- 箭头图标 -->
              <div
                class="shrink-0 w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center group-hover:bg-stone-800 transition-all duration-300"
              >
                <svg
                  class="w-5 h-5 text-stone-400 group-hover:text-white transition-colors duration-300 transform group-hover:translate-x-0.5"
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
          </div>
        </NuxtLink>
      </article>
    </div>

    <!-- 分页 -->
    <div
      v-if="totalPages > 1"
      class="flex items-center justify-end gap-2 mt-10"
    >
      <!-- 上一页 -->
      <button
        @click="currentPage--"
        :disabled="currentPage === 1"
        class="w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all duration-200"
        :class="currentPage === 1
          ? 'text-stone-300 cursor-not-allowed'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800'
        "
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <!-- 页码 -->
      <button
        v-for="page in visiblePages"
        :key="page"
        @click="currentPage = page"
        class="min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-all duration-200"
        :class="page === currentPage
          ? 'bg-stone-800 text-white shadow-sm'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800'
        "
      >
        {{ page }}
      </button>

      <!-- 下一页 -->
      <button
        @click="currentPage++"
        :disabled="currentPage === totalPages"
        class="w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all duration-200"
        :class="currentPage === totalPages
          ? 'text-stone-300 cursor-not-allowed'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800'
        "
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/>
        </svg>
      </button>
    </div>

    <!-- 空状态 -->
    <Transition name="fade">
      <div
        v-if="!posts || posts.length === 0"
        class="text-center py-20"
      >
        <div
          class="w-20 h-20 bg-linear-to-br from-stone-100 to-stone-200 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner"
        >
          <svg
            class="w-10 h-10 text-stone-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-stone-700 mb-2">暂无文章</h3>
        <p class="text-sm text-stone-500">敬请期待精彩内容</p>
      </div>
    </Transition>
  </div>
</template>

<script setup>
useHead({
  title: "aissr",
  meta: [{ name: "description", content: "aissr - 关于技术与生活的思考" }],
});

/**
 * 格式化日期字符串为中文日期格式
 * @param {string} dateStr - 日期字符串
 * @returns {string} - 格式化后的日期字符串
 */
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// · 解析标签字符串为数组
const parseTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.slice(0, 3);
  if (typeof tags === "string")
    return tags
      .split(",")
      .map((t) => t.trim())
      .slice(0, 3);
  return [];
};

// · 计算文章阅读时间（分钟）
const getReadingTime = (body) => {
  if (!body?.value) return 1;
  const text = JSON.stringify(body.value);
  const words = text.length / 2;
  return Math.max(1, Math.ceil(words / 300));
};

const { data: posts } = await useAsyncData("posts", () => {
  return queryCollection("content").all();
});

// 分页配置
const pageSize = 6;
const route = useRoute();
const router = useRouter();

// 从 URL 读取页码，默认第 1 页
const currentPage = ref(parseInt(route.query.page?.toString() || "1") || 1);

// 分页后的文章
const paginatedPosts = computed(() => {
  if (!posts.value) return [];
  const start = (currentPage.value - 1) * pageSize;
  return posts.value.slice(start, start + pageSize);
});

// 总页数
const totalPages = computed(() => {
  if (!posts.value) return 0;
  return Math.ceil(posts.value.length / pageSize);
});

// 可见页码（最多显示 5 个）
const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages.value, start + maxVisible - 1);
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

// 页码变化时同步到 URL 并滚动到顶部
watch(currentPage, (newPage, oldPage) => {
  if (newPage !== oldPage) {
    router.push({
      query: { ...route.query, page: newPage > 1 ? newPage.toString() : undefined }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});
</script>

<style scoped>
/* 淡入动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 文章卡片入场动画 */
article {
  animation: slideIn 0.5s ease-out forwards;
  opacity: 0;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
