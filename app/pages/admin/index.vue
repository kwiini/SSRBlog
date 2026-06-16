<template>
  <div>
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-semibold text-stone-800">文章管理</h1>
        <p class="text-sm text-stone-500 mt-1">
          管理博客文章，支持编辑、删除和重新向量化
        </p>
      </div>
      <NuxtLink
        to="/admin/write"
        class="flex items-center gap-2 px-5 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-all shadow-sm hover:shadow-md"
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
            d="M12 4v16m8-8H4"
          />
        </svg>
        写文章
      </NuxtLink>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <div class="bg-white border border-stone-200/60 rounded-xl p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"
          >
            <svg
              class="w-5 h-5 text-blue-500"
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
          </div>
          <div>
            <p class="text-2xl font-bold text-stone-800">{{ posts.length }}</p>
            <p class="text-xs text-stone-500">已发布</p>
          </div>
        </div>
      </div>
      <div class="bg-white border border-stone-200/60 rounded-xl p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"
          >
            <svg
              class="w-5 h-5 text-amber-500"
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
          </div>
          <div>
            <p class="text-2xl font-bold text-stone-800">{{ drafts.length }}</p>
            <p class="text-xs text-stone-500">草稿箱</p>
          </div>
        </div>
      </div>
      <div class="bg-white border border-stone-200/60 rounded-xl p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"
          >
            <svg
              class="w-5 h-5 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-stone-800">
              {{ vectorStats?.articleCount || 0 }}
            </p>
            <p class="text-xs text-stone-500">已向量化</p>
          </div>
        </div>
      </div>
      <div class="bg-white border border-stone-200/60 rounded-xl p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center"
          >
            <svg
              class="w-5 h-5 text-stone-500"
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
          </div>
          <div>
            <p class="text-sm font-semibold text-stone-700">
              {{ formatDate(vectorStats?.lastUpdated) || "未生成" }}
            </p>
            <p class="text-xs text-stone-500">最后更新</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="flex items-center gap-2 mb-4">
      <button
        @click="activeTab = 'published'"
        :class="activeTab === 'published' ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
      >
        已发布 ({{ posts.length }})
      </button>
      <button
        @click="activeTab = 'drafts'"
        :class="activeTab === 'drafts' ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
      >
        草稿箱 ({{ drafts.length }})
      </button>
    </div>

    <!-- 文章列表 -->
    <div
      class="bg-white border border-stone-200/60 rounded-xl shadow-sm overflow-hidden"
    >
      <div
        class="px-6 py-4 border-b border-stone-100 flex items-center justify-between"
      >
        <h2 class="font-semibold text-stone-800">
          {{ activeTab === 'published' ? '已发布文章' : '草稿箱' }}
        </h2>
        <button
          v-if="activeTab === 'published'"
          @click="regenerateVectors"
          :disabled="regenerating"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-all"
        >
          <svg
            v-if="regenerating"
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
          {{ regenerating ? "向量化中..." : "重新向量化" }}
        </button>
      </div>

      <div class="divide-y divide-stone-100">
        <div
          v-for="post in currentList"
          :key="post.path + (post.isDraft ? '_draft' : '_published')"
          class="px-6 py-4 hover:bg-stone-50/50 transition-colors flex items-center justify-between group"
        >
          <div class="flex-1 min-w-0 mr-4">
            <div class="flex items-center gap-3 mb-1">
              <h3 class="font-medium text-stone-800 truncate">
                {{ post.title }}
              </h3>
              <span
                v-if="isVectorized(post.path)"
                class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full"
              >
                已向量化
              </span>
              <span
                v-else
                class="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full"
              >
                未向量化
              </span>
            </div>
            <p class="text-sm text-stone-500 truncate">
              {{ post.description || "暂无描述" }}
            </p>
            <p class="text-xs text-stone-400 mt-1">
              {{ formatDate(post.meta?.date) }}
            </p>
          </div>

          <div
            class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <NuxtLink
              :to="`/admin/write?edit=${encodeURIComponent(post.path)}${post.isDraft ? '&fromDraft=1' : ''}`"
              class="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-all"
              title="编辑"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </NuxtLink>
            <button
              @click="deletePost(post)"
              class="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="删除"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="currentList.length === 0"
          class="px-6 py-12 text-center"
        >
          <div
            class="w-16 h-16 bg-stone-100 rounded-xl flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-8 h-8 text-stone-400"
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
          </div>
          <p class="text-stone-500">暂无文章</p>
          <NuxtLink
            to="/admin/write"
            class="inline-flex items-center gap-2 mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            写第一篇文章
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- 提示消息 -->
    <Transition name="toast">
      <div
        v-if="toast.show"
        class="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm shadow-lg flex items-center gap-2"
        :class="
          toast.type === 'success'
            ? 'bg-stone-800 text-white'
            : 'bg-red-600 text-white'
        "
      >
        <svg
          v-if="toast.type === 'success'"
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
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
definePageMeta({
  layout: "default",
});

const posts = ref([]);  // 已发布文章列表
const drafts = ref([]); // 草稿列表
const activeTab = ref("published"); // 'published' | 'drafts'
const vectorStats = ref(null); // 向量状态信息
const regenerating = ref(false); // 是否正在重新向量化
const toast = ref({ show: false, message: "", type: "success" }); // 提示消息

// 当前显示的列表
const currentList = computed(() => {
  return activeTab.value === "published" ? posts.value : drafts.value;
});

// 获取已发布文章列表
const fetchPosts = async () => {
  try {
    const data = await queryCollection("content").all();
    posts.value = (data || []).map((p) => ({ ...p, isDraft: false }));
  } catch (err) {
    // console.error("获取文章失败:", err);
    posts.value = [];
  }
};

// 获取草稿列表
const fetchDrafts = async () => {
  try {
    const res = await $fetch("/api/blog/posts?listDrafts=1");
    // 草稿不在 queryCollection 中，需要从文件系统读取 frontmatter
    const draftItems = res?.data || [];
    drafts.value = await Promise.all(
      draftItems.map(async (item) => {
        try {
          const fileRes = await $fetch(
            `/api/posts/get?path=${encodeURIComponent(item.path)}&fromDraft=1`
          );
          return {
            path: item.path,
            slug: item.slug,
            title: fileRes?.data?.meta?.title || item.slug,
            description: fileRes?.data?.meta?.description || "草稿",
            meta: fileRes?.data?.meta || {},
            isDraft: true,
          };
        } catch {
          return {
            path: item.path,
            slug: item.slug,
            title: item.slug,
            description: "草稿",
            meta: {},
            isDraft: true,
          };
        }
      })
    );
  } catch (err) {
    // console.error("获取草稿失败:", err);
    drafts.value = [];
  }
};

// 获取向量统计
const fetchVectorStats = async () => {
  try {
    const data = await $fetch("/api/blog/vectorize");
    vectorStats.value = data;
  } catch (err) {
    // console.error("获取向量统计失败:", err);
  }
};

// 检查文章是否已向量化
const isVectorized = (path) => {
  if (!vectorStats.value?.articles) return false;
  return vectorStats.value.articles.some((a) => a.path === path);
};

// 重新向量化
const regenerateVectors = async () => {
  regenerating.value = true;
  try {
    await $fetch("/api/blog/vectorize", {
      method: "POST",
      body: { force: true },
    });
    await fetchVectorStats();
    showToast("向量化完成", "success");
  } catch (err) {
    showToast("向量化失败: " + err.message, "error");
  } finally {
    regenerating.value = false;
  }
};

// 删除文章
const deletePost = async (post) => {
  if (!confirm(`确定要删除${post.isDraft ? '草稿' : '文章'} "${post.title}" 吗？`)) return;

  try {
    await $fetch("/api/blog/posts", {
      method: "DELETE",
      body: { path: post.path, fromDraft: post.isDraft },
    });

    // 已发布文章需同步从向量存储中移除
    if (!post.isDraft) {
      await removeFromVectors(post.path);
    }

    // 强制刷新文章列表（清除缓存）
    await refreshNuxtData();
    await fetchPosts();
    await fetchDrafts();
    if (!post.isDraft) await fetchVectorStats();

    showToast("删除成功", "success");
  } catch (err) {
    showToast("删除失败: " + err.message, "error");
  }
};

// 从向量存储中移除文章
const removeFromVectors = async (path) => {
  try {
    await $fetch("/api/blog/vectorize", {
      method: "DELETE",
      body: { path },
    });
  } catch (err) {
    // console.error("从向量存储移除失败:", err);
  }
};

// 显示提示
const showToast = (message, type = "success") => {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

onMounted(() => {
  fetchPosts();
  fetchDrafts();
  fetchVectorStats();
});
</script>

<style scoped>
/* Toast 动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
