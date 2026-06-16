<template>
  <div>
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <NuxtLink
          to="/admin"
          class="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-all"
        >
          <svg
            class="w-5 h-5"
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
        </NuxtLink>
        <div>
          <h1 class="text-2xl font-semibold text-stone-800">
            {{ isEditing ? "编辑文章" : "写文章" }}
          </h1>
          <p class="text-sm text-stone-500 mt-1">
            {{
              isEditing ? "修改文章内容并更新向量" : "创建新文章并自动生成向量"
            }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="saveDraft"
          :disabled="saving"
          class="px-5 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
        >
          {{ saving ? "保存中..." : "保存草稿" }}
        </button>
        <button
          @click="publishPost"
          :disabled="saving || vectorizing"
          class="flex items-center gap-2 px-5 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
        >
          <svg
            v-if="vectorizing"
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
              d="M5 13l4 4L19 7"
            />
          </svg>
          {{
            vectorizing ? "向量化中..." : isEditing ? "更新发布" : "发布文章"
          }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <!-- 编辑区域 -->
      <div class="col-span-2 space-y-4">
        <!-- 标题输入 -->
        <div
          class="bg-white border border-stone-200/60 rounded-xl p-4 shadow-sm"
        >
          <label class="block text-sm font-medium text-stone-700 mb-2"
            >文章标题</label
          >
          <input
            v-model="post.title"
            type="text"
            placeholder="输入文章标题..."
            class="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent transition-all"
          />
        </div>

        <!-- 内容编辑 -->
        <div
          class="bg-white border border-stone-200/60 rounded-xl shadow-sm overflow-hidden"
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-stone-100"
          >
            <label class="text-sm font-medium text-stone-700"
              >文章内容 (Markdown)</label
            >
            <div class="flex items-center gap-2">
              <button
                @click="insertTemplate"
                class="text-xs text-stone-500 hover:text-stone-800 px-2 py-1 hover:bg-stone-100 rounded transition-all"
              >
                插入模板
              </button>
              <span class="text-xs text-stone-400">{{ contentStats }}</span>
            </div>
          </div>
          <textarea
            v-model="post.content"
            placeholder="在此输入 Markdown 格式的文章内容..."
            class="w-full h-[500px] px-4 py-4 bg-stone-50 text-stone-800 placeholder-stone-400 resize-none focus:outline-none font-mono text-sm leading-relaxed"
          ></textarea>
        </div>
      </div>

      <!-- 侧边栏设置 -->
      <div class="space-y-4">
        <!-- 文章信息 -->
        <div
          class="bg-white border border-stone-200/60 rounded-xl p-5 shadow-sm"
        >
          <h3 class="font-semibold text-stone-800 mb-4 flex items-center gap-2">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            文章信息
          </h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2"
                >文章路径</label
              >
              <div class="flex items-center gap-2">
                <span class="text-sm text-stone-400">/articles/</span>
                <input
                  v-model="post.slug"
                  type="text"
                  :disabled="isEditing"
                  placeholder="article-slug"
                  class="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <p class="text-xs text-stone-400 mt-1">
                用于 URL，只能包含字母、数字和连字符
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2"
                >发布日期</label
              >
              <input
                v-model="post.date"
                type="date"
                class="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-stone-700 mb-2"
                >标签</label
              >
              <input
                v-model="post.tags"
                type="text"
                placeholder="用逗号分隔，如: Vue, Nuxt, 前端"
                class="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>
          </div>
        </div>

        <!-- 描述 -->
        <div
          class="bg-white border border-stone-200/60 rounded-xl p-5 shadow-sm"
        >
          <label class="block text-sm font-medium text-stone-700 mb-2"
            >文章描述</label
          >
          <textarea
            v-model="post.description"
            placeholder="简要描述文章内容..."
            rows="4"
            class="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-stone-300"
          ></textarea>
          <p class="text-xs text-stone-400 mt-2">
            显示在文章列表中，建议 100-200 字
          </p>
        </div>

        <!-- 预览提示 -->
        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <svg
              class="w-5 h-5 text-blue-500 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p class="text-sm font-medium text-blue-800">发布说明</p>
              <p class="text-xs text-blue-600 mt-1">
                发布后文章将自动进行向量化，用于智能搜索和相关文章推荐功能。
              </p>
            </div>
          </div>
        </div>

        <!-- 向量化进度 -->
        <div
          v-if="vectorizing"
          class="bg-emerald-50 border border-emerald-100 rounded-xl p-4"
        >
          <div class="flex items-center gap-3">
            <svg
              class="w-5 h-5 text-emerald-500 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-medium text-emerald-800">正在向量化...</p>
              <div
                class="mt-2 h-1.5 bg-emerald-200 rounded-full overflow-hidden"
              >
                <div
                  class="h-full bg-emerald-500 rounded-full animate-pulse"
                  style="width: 60%"
                ></div>
              </div>
            </div>
          </div>
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

const route = useRoute();
const router = useRouter();

const isEditing = ref(false); // 是否正在编辑文章
const saving = ref(false); // 是否正在保存文章
const vectorizing = ref(false); // 是否正在向量化文章
const toast = ref({ show: false, message: "", type: "success" }); // 提示消息

// 文章数据
const post = ref({
  title: "",
  slug: "",
  content: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  tags: "",
});

// 计算内容统计
const contentStats = computed(() => {
  const content = String(post.value.content || "");
  const words = content.length;
  const lines = content.split("\n").length;
  return `${words} 字 · ${lines} 行`;
});

// 插入模板
const insertTemplate = () => {
  const template = `---
title: ${post.value.title || "文章标题"}
description: ${post.value.description || "文章描述"}
date: ${post.value.date}
tags: [${
    post.value.tags
      .split(",")
      .map((t) => `'${t.trim()}'`)
      .join(", ") || ""
  }]
---

# ${post.value.title || "文章标题"}

开始编写文章内容...

## 章节一

内容...

## 章节二

内容...
`;
  post.value.content = template;
};

// 加载文章数据
const loadPost = async (path, fromDraft = false) => {
  if (!path || path === 'undefined') return;
  try {
    const data = await queryCollection("content").path(path).first();
    if (data) {
      // 读取原始 markdown 文件
      const slug = path.replace("/articles/", "").replace(/^\//, "");
      let rawContent = "";
      try {
        const fileData = await $fetch(
          `/api/posts/get?path=${encodeURIComponent(path)}${fromDraft ? '&fromDraft=1' : ''}`
        );
        rawContent = fileData?.data?.content || "";
      } catch {
        // 加载失败
      }

      post.value = {
        title: data.title || "",
        slug,
        content: rawContent,
        description: data.description || "",
        date: data.meta?.date || new Date().toISOString().split("T")[0],
        tags: Array.isArray(data.meta?.tags)
          ? data.meta.tags.join(", ")
          : data.meta?.tags || "",
      };
      isEditing.value = true;
    } else if (fromDraft) {
      // 草稿不在 queryCollection 中，直接读文件
      const slug = path.replace("/articles/", "").replace(/^\//, "");
      try {
        const fileData = await $fetch(
          `/api/posts/get?path=${encodeURIComponent(path)}&fromDraft=1`
        );
        const meta = fileData?.data?.meta || {};
        post.value = {
          title: meta.title || slug,
          slug,
          content: fileData?.data?.content || "",
          description: meta.description || "",
          date: meta.date || new Date().toISOString().split("T")[0],
          tags: Array.isArray(meta.tags) ? meta.tags.join(", ") : meta.tags || "",
        };
        isEditing.value = true;
      } catch (err) {
        showToast("加载草稿失败", "error");
      }
    }
  } catch (err) {
    showToast("加载文章失败", "error");
  }
};

// 页面加载
const editPath = typeof route.query.edit === 'string' ? route.query.edit : undefined;
const fromDraft = route.query.fromDraft === '1' || route.query.fromDraft === 'true';
if (editPath && editPath !== 'undefined') {
  await loadPost(editPath, fromDraft);
}

// 保存草稿
const saveDraft = async () => {
  if (!validatePost()) return;

  saving.value = true;
  try {
    await savePost(false);
    showToast("草稿保存成功", "success");
  } catch (err) {
    showToast("保存失败: " + err.message, "error");
  } finally {
    saving.value = false;
  }
};

// 发布文章
const publishPost = async () => {
  if (!validatePost()) return;

  saving.value = true;
  try {
    const result = await savePost(true);
    const postPath = result.path || `/articles/${post.value.slug}`;

    // 触发增量向量化 - 只处理当前文章
    vectorizing.value = true;
    try {
      await $fetch("/api/blog/vectorize", {
      method: "POST",
      body: { path: postPath, force: false },
    });
    } catch (vecErr) {
    }

    showToast(isEditing.value ? "文章更新成功" : "文章发布成功", "success");

    // 延迟跳转到文章列表
    setTimeout(() => {
      router.push("/admin");
    }, 1500);
  } catch (err) {
    showToast("发布失败: " + err.message, "error");
  } finally {
    saving.value = false;
    vectorizing.value = false;
  }
};

// 保存文章到服务器
const savePost = async (publish = false) => {
  const articleData = {
    title: post.value.title,
    slug: post.value.slug,
    content: post.value.content,
    description: post.value.description,
    date: post.value.date,
    tags: post.value.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    publish,
  };

  const result = await $fetch("/api/blog/posts", {
    method: isEditing.value ? "PUT" : "POST",
    body: {
      ...articleData,
      // PUT 时带上原 slug 作 id,服务端用它定位旧文件(支持重命名)
      id: isEditing.value ? post.value.slug : undefined,
    },
  });

  // 服务端必定返回 data:{ path, slug }(归一化后),不再用原始 slug 兜底
  if (!result?.data?.path) {
    throw new Error("服务端未返回文章路径");
  }
  return result.data;
};

// 验证表单
const validatePost = () => {
  if (!post.value.title.trim()) {
    showToast("请输入文章标题", "error");
    return false;
  }
  if (!post.value.slug.trim()) {
    showToast("请输入文章路径", "error");
    return false;
  }
  if (!post.value.content.trim()) {
    showToast("请输入文章内容", "error");
    return false;
  }
  return true;
};

// 显示提示
const showToast = (message, type = "success") => {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

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
