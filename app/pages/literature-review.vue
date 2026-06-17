<template>
  <div>
    <!-- 标题区 -->
    <div class="mb-8 flex items-start justify-between gap-6 flex-wrap">
      <div>
        <div class="flex items-center gap-3 mb-3">
          <div
            class="w-1 h-6 bg-linear-to-b from-stone-700 to-stone-500 rounded-full"
          ></div>
          <h1 class="text-2xl font-semibold text-stone-800">文献综述</h1>
        </div>
        <p class="text-sm text-stone-500 ml-4">
          上传文献内容，AI 帮你提炼要点、总结创新点，生成可直接汇报的文献综述
        </p>
      </div>

      <!-- 用户标识 + 归档入口 -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-xs text-stone-500">汇报人</label>
          <input
            v-model="userName"
            @blur="saveUserName"
            placeholder="可选：填写后将写入归档"
            class="w-44 px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 transition-colors"
          />
        </div>
        <button
          @click="
            showArchive = !showArchive;
            if (showArchive) loadArchiveList();
          "
          class="px-3 py-1.5 text-xs font-medium bg-white border border-stone-200 rounded-lg hover:border-stone-400 transition-colors flex items-center gap-1.5"
        >
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
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
          历史归档
          <span
            v-if="archiveList.length"
            class="px-1.5 py-0.5 text-[10px] bg-stone-100 rounded"
            >{{ archiveList.length }}</span
          >
        </button>
      </div>
    </div>

    <!-- 归档面板 -->
    <div
      v-if="showArchive"
      class="mb-8 bg-white border border-stone-200/60 rounded-2xl p-6"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-stone-700">历史归档</h3>
        <button
          @click="loadArchiveList"
          class="text-xs text-stone-500 hover:text-stone-700"
        >
          刷新
        </button>
      </div>
      <!-- 归档列表依赖 auth 态 + localStorage,服务端无法预测,走 ClientOnly 避免 hydration mismatch -->
      <ClientOnly>
        <div
          v-if="archiveLoading"
          class="text-xs text-stone-400 py-4 text-center"
        >
          加载中…
        </div>
        <div
          v-else-if="!isLoggedIn"
          class="text-xs text-stone-500 py-6 text-center"
        >
          请先在右上角点击「管理员」登录后查看历史归档。
        </div>
        <div
          v-else-if="archiveList.length === 0"
          class="text-xs text-stone-400 py-6 text-center"
        >
          还没有归档记录。生成综述后会自动保存到服务器。
        </div>
        <div
          v-else
          class="space-y-2"
        >
          <div
            v-for="item in archiveList"
            :key="item.id"
            class="flex items-center gap-4 p-3 border border-stone-100 rounded-lg hover:border-stone-200 transition-colors"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-stone-700 truncate">
                {{ item.field || "（未命名）" }}
                <span
                  v-if="item.reporter"
                  class="text-stone-400 font-normal"
                  >· {{ item.reporter }}</span
                >
              </p>
              <p class="text-xs text-stone-400 mt-0.5">
                {{ item.paper_count }} 篇文献 · 创建于
                {{ formatTimestamp(item.created_at) }}
                <span v-if="item.updated_at !== item.created_at">
                  · 更新于 {{ formatTimestamp(item.updated_at) }}</span
                >
              </p>
            </div>
            <button
              @click="loadFromArchive(item.id)"
              class="px-3 py-1 text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded hover:border-stone-400 transition-colors"
            >
              打开
            </button>
            <button
              @click="deleteArchive(item.id)"
              class="px-2 py-1 text-xs text-stone-400 hover:text-red-500 transition-colors"
            >
              删除
            </button>
          </div>
        </div>

        <!-- 审计日志折叠区 -->
        <div class="mt-3 pt-3 border-t border-stone-100">
          <button
            @click="
              showAudit = !showAudit;
              if (showAudit) loadAuditList();
            "
            class="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1"
          >
            <svg
              class="w-3 h-3 transition-transform"
              :class="{ 'rotate-90': showAudit }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
            操作审计日志
          </button>
          <div
            v-if="showAudit"
            class="mt-2"
          >
            <div
              v-if="auditLoading"
              class="text-xs text-stone-400 py-2 text-center"
            >
              加载中…
            </div>
            <div
              v-else-if="auditList.length === 0"
              class="text-xs text-stone-400 py-2"
            >
              暂无操作记录
            </div>
            <div
              v-else
              class="space-y-1 max-h-48 overflow-y-auto"
            >
              <div
                v-for="log in auditList"
                :key="log.id"
                class="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-stone-50"
              >
                <span
                  :class="actionColor(log.action)"
                  class="font-medium w-8 shrink-0"
                  >{{ actionLabel(log.action) }}</span
                >
                <span class="text-stone-500 truncate flex-1">{{
                  log.detail || log.review_id
                }}</span>
                <span class="text-stone-400 shrink-0">{{
                  formatTimestamp(log.created_at)
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <p
          class="text-[11px] text-stone-400 mt-3 pt-3 border-t border-stone-100"
        >
          数据保存在服务器 SQLite 数据库（<code class="px-1 bg-stone-50 rounded"
            >data/literature-review.db</code
          >），换电脑/换浏览器仍可访问。
        </p>
      </ClientOnly>
    </div>

    <!-- 上传区 -->
    <div
      class="mb-8 bg-white border border-stone-200/60 rounded-2xl p-8 transition-all duration-300"
      :class="{ 'border-stone-400 shadow-lg shadow-stone-200/50': isDragging }"
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <div class="text-center">
        <div
          class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-stone-100 flex items-center justify-center"
        >
          <svg
            class="w-7 h-7 text-stone-500"
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
        <h3 class="text-base font-medium text-stone-700 mb-2">
          拖拽文献到此处，或
          <label
            class="text-stone-900 underline underline-offset-2 cursor-pointer hover:text-stone-600 transition-colors"
          >
            点击上传
            <input
              type="file"
              class="hidden"
              accept=".txt,.md,.pdf,.doc,.docx"
              multiple
              @change="handleFileSelect"
            />
          </label>
        </h3>
        <p class="text-xs text-stone-400">
          支持 TXT、Markdown、PDF、Word 格式，可一次上传多篇文献
        </p>
      </div>
    </div>

    <!-- 文献列表 -->
    <div
      v-if="papers.length > 0"
      class="mb-8 space-y-3"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-medium text-stone-600">
          已上传 {{ papers.length }} 篇文献
        </h2>
        <button
          class="text-xs text-stone-500 hover:text-red-500 transition-colors"
          @click="clearAll"
        >
          清空全部
        </button>
      </div>

      <div
        v-for="(paper, index) in papers"
        :key="paper.id"
        class="bg-white border border-stone-200/60 rounded-xl p-4 flex items-center gap-4 group hover:border-stone-300 transition-all"
      >
        <div
          class="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0 cursor-pointer hover:bg-stone-200 transition-colors"
          @click="openPreview(paper)"
        >
          <span class="text-xs font-medium text-stone-500">{{
            index + 1
          }}</span>
        </div>
        <div
          class="flex-1 min-w-0 cursor-pointer"
          @click="openPreview(paper)"
        >
          <p
            class="text-sm font-medium text-stone-700 truncate group-hover:text-stone-900 transition-colors"
          >
            {{ paper.name }}
          </p>
          <p class="text-xs text-stone-400 mt-0.5 flex items-center gap-1.5">
            <span
              >{{ formatSize(paper.size) }} ·
              {{ paper.content?.length || 0 }} 字</span
            >
            <span
              v-if="!paper.content"
              class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-medium"
              >需重新上传</span
            >
          </p>
        </div>
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all"
          title="预览"
          @click="openPreview(paper)"
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
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </button>
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
          @click="removePaper(index)"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- 预览模态框 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="previewPaper"
          class="fixed inset-0 z-100 flex items-start justify-center pt-6 pb-6 px-4 sm:px-8"
          @click.self="closePreview"
        >
          <!-- 遮罩 -->
          <div
            class="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            @click="closePreview"
          ></div>

          <!-- 内容区 -->
          <div
            class="relative w-full max-w-5xl h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <!-- 头部 -->
            <div
              class="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0"
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div class="min-w-0">
                  <h3 class="text-sm font-semibold text-stone-800 truncate">
                    {{ previewPaper.name }}
                  </h3>
                  <p class="text-xs text-stone-400">
                    {{ formatSize(previewPaper.size) }} ·
                    {{ previewPaper.content?.length || 0 }} 字
                  </p>
                </div>
              </div>
              <button
                class="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all shrink-0"
                @click="closePreview"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <!-- 正文 -->
            <div class="flex-1 overflow-hidden">
              <!-- PDF 用 iframe 原生预览 -->
              <iframe
                v-if="previewPaper.isPdf && previewPaper.blobUrl"
                :src="previewPaper.blobUrl"
                class="w-full h-full border-0"
              ></iframe>
              <!-- docx 用 mammoth 渲染的 HTML -->
              <div
                v-else-if="previewPaper.isDocx"
                class="h-full overflow-y-auto p-8 docx-preview"
                v-html="
                  previewPaper.htmlContent ||
                  '<p class=\'text-stone-400 text-sm\'>该文档无内容</p>'
                "
              ></div>
              <!-- doc 旧格式不支持预览，提供下载 -->
              <div
                v-else-if="previewPaper.isDoc"
                class="h-full flex flex-col items-center justify-center p-8 text-center"
              >
                <div
                  class="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-4"
                >
                  <svg
                    class="w-7 h-7 text-stone-500"
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
                <p class="text-sm font-medium text-stone-700 mb-1">
                  .doc 格式暂不支持在线预览
                </p>
                <p class="text-xs text-stone-400 mb-4">
                  请下载后用 Word 打开，或另存为 .docx 重新上传
                </p>
                <a
                  v-if="previewPaper.blobUrl"
                  :href="previewPaper.blobUrl"
                  :download="previewPaper.name"
                  class="px-4 py-2 bg-stone-800 text-white rounded-lg text-xs font-medium hover:bg-stone-700 transition-colors"
                >
                  下载文件
                </a>
              </div>
              <!-- 其他文件用文本预览 -->
              <div
                v-else
                class="h-full overflow-y-auto p-6"
              >
                <div
                  v-if="!previewPaper.content"
                  class="h-full flex flex-col items-center justify-center text-center"
                >
                  <p class="text-sm text-stone-500 mb-1">文本内容未保留</p>
                  <p class="text-xs text-stone-400">
                    为节省存储空间，刷新页面后大文档的文本内容会被丢弃，请重新上传该文件
                  </p>
                </div>
                <pre
                  v-else
                  class="whitespace-pre-wrap text-sm text-stone-700 leading-relaxed font-sans"
                  >{{ previewPaper.content }}</pre
                >
              </div>
            </div>

            <!-- 底部 -->
            <div
              class="px-6 py-3 border-t border-stone-100 shrink-0 flex justify-end"
            >
              <button
                class="px-4 py-2 bg-stone-800 text-white rounded-lg text-xs font-medium hover:bg-stone-700 transition-colors"
                @click="closePreview"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 生成按钮 -->
    <div
      v-if="papers.length > 0"
      class="mb-10"
    >
      <button
        class="w-full py-3.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="generating"
        @click="generateReview"
      >
        <svg
          v-if="generating"
          class="w-4 h-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span>{{ generating ? "正在生成综述..." : "生成文献综述" }}</span>
      </button>

      <!-- 综述结果 -->
      <!-- reviewResult 是客户端态(打开归档后才有数据),server 渲染时是 null → 包 ClientOnly 避免 hydration mismatch -->
      <ClientOnly>
        <div
          v-if="reviewResult"
          class="space-y-6"
        >
          <!-- 操作栏 -->
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-stone-800">综述结果</h2>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-stone-800 hover:bg-stone-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                :disabled="savingArchive"
                @click="saveToArchive"
              >
                <svg
                  v-if="!savingArchive"
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                <span v-else>保存中…</span>
                <span v-if="!savingArchive">保存到归档</span>
              </button>
              <button
                class="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5"
                @click="copyResult"
              >
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                复制
              </button>
              <button
                class="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5"
                @click="exportMarkdown"
              >
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                导出 Markdown
              </button>
            </div>
          </div>

          <!-- 综述卡片 -->
          <div
            class="bg-white border border-stone-200/60 rounded-2xl overflow-hidden"
          >
            <!-- 基本信息 -->
            <div class="p-6 border-b border-stone-100">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-stone-500 mb-1.5"
                    >研究领域</label
                  >
                  <input
                    v-model="reviewResult.field"
                    type="text"
                    class="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
                    placeholder="填写研究领域"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-stone-500 mb-1.5"
                    >汇报人</label
                  >
                  <input
                    v-model="reviewResult.reporter"
                    type="text"
                    class="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
                    placeholder="填写汇报人姓名"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-stone-500 mb-1.5"
                    >汇报日期</label
                  >
                  <input
                    v-model="reviewResult.date"
                    type="date"
                    class="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-stone-500 mb-1.5"
                    >文献数量</label
                  >
                  <input
                    :value="papers.length + ' 篇'"
                    type="text"
                    readonly
                    class="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-sm text-stone-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <!-- 可编辑的综述内容 -->
            <div class="p-6 space-y-6">
              <!-- 研究背景 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-1 h-4 bg-stone-400 rounded-full"></div>
                  <h3 class="text-sm font-semibold text-stone-700">
                    研究背景与意义
                  </h3>
                </div>
                <textarea
                  v-model="reviewResult.background"
                  rows="4"
                  class="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-700 leading-relaxed focus:outline-none focus:border-stone-400 transition-colors resize-y"
                  placeholder="文献涉及的研究背景与意义..."
                ></textarea>
              </div>

              <!-- 核心内容 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-1 h-4 bg-stone-400 rounded-full"></div>
                  <h3 class="text-sm font-semibold text-stone-700">
                    核心内容梳理
                  </h3>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="(item, idx) in reviewResult.coreContents"
                    :key="idx"
                    class="bg-stone-50 border border-stone-200 rounded-xl p-4"
                  >
                    <div class="flex items-start gap-3">
                      <span
                        class="w-6 h-6 rounded-md bg-stone-200 flex items-center justify-center text-xs font-medium text-stone-600 shrink-0 mt-0.5"
                        >{{ idx + 1 }}</span
                      >
                      <div class="flex-1 space-y-2">
                        <input
                          v-model="item.title"
                          type="text"
                          class="w-full px-2 py-1 bg-white border border-stone-200 rounded-md text-sm font-medium text-stone-700 focus:outline-none focus:border-stone-400"
                          placeholder="文献标题"
                        />
                        <textarea
                          v-model="item.summary"
                          rows="2"
                          class="w-full px-2 py-1.5 bg-white border border-stone-200 rounded-md text-sm text-stone-600 leading-relaxed focus:outline-none focus:border-stone-400 resize-y"
                          placeholder="该文献的核心观点与贡献..."
                        ></textarea>
                        <div class="flex gap-2">
                          <input
                            v-model="item.method"
                            type="text"
                            class="flex-1 px-2 py-1 bg-white border border-stone-200 rounded-md text-xs text-stone-500 focus:outline-none focus:border-stone-400"
                            placeholder="研究方法"
                          />
                          <input
                            v-model="item.conclusion"
                            type="text"
                            class="flex-1 px-2 py-1 bg-white border border-stone-200 rounded-md text-xs text-stone-500 focus:outline-none focus:border-stone-400"
                            placeholder="主要结论"
                          />
                        </div>
                      </div>
                      <button
                        class="w-6 h-6 rounded-md flex items-center justify-center text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                        @click="removeCoreItem(idx)"
                      >
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button
                    class="w-full py-2 border border-dashed border-stone-300 rounded-xl text-xs text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-all flex items-center justify-center gap-1.5"
                    @click="addCoreItem"
                  >
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    添加文献条目
                  </button>
                </div>
              </div>

              <!-- 创新点对比 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-1 h-4 bg-stone-400 rounded-full"></div>
                  <h3 class="text-sm font-semibold text-stone-700">
                    创新点与对比分析
                  </h3>
                </div>
                <textarea
                  v-model="reviewResult.innovation"
                  rows="4"
                  class="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-700 leading-relaxed focus:outline-none focus:border-stone-400 transition-colors resize-y"
                  placeholder="各文献的创新点对比分析..."
                ></textarea>
              </div>

              <!-- 研究趋势 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-1 h-4 bg-stone-400 rounded-full"></div>
                  <h3 class="text-sm font-semibold text-stone-700">
                    研究趋势与展望
                  </h3>
                </div>
                <textarea
                  v-model="reviewResult.trend"
                  rows="4"
                  class="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-700 leading-relaxed focus:outline-none focus:border-stone-400 transition-colors resize-y"
                  placeholder="该领域的研究趋势与未来展望..."
                ></textarea>
              </div>

              <!-- 个人思考 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-1 h-4 bg-stone-400 rounded-full"></div>
                  <h3 class="text-sm font-semibold text-stone-700">
                    个人思考与启发
                  </h3>
                </div>
                <textarea
                  v-model="reviewResult.thoughts"
                  rows="4"
                  class="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-700 leading-relaxed focus:outline-none focus:border-stone-400 transition-colors resize-y"
                  placeholder="阅读后的个人思考与对工作的启发..."
                ></textarea>
              </div>
            </div>
          </div>
        </div>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import { logger } from "../lib/logger";
// 文献归档相关接口 (list / save / [id] / audit) 走 admin JWT 鉴权
// 未登录用户调这些接口会直接 401,页面要按登录态短路
const { currentUser, checkAuth: recheckAuth } = useAdminAuth();
const isLoggedIn = computed(() => currentUser.value.isLoggedIn);

// · 文献条目
interface Paper {
  id: string;
  name: string;
  size: number;
  content: string;
  contentHash?: string;
  blobUrl?: string;
  isPdf?: boolean;
  isDocx?: boolean;
  isDoc?: boolean;
  htmlContent?: string;
}

// · 核心内容条目
interface CoreContent {
  title: string;
  summary: string;
  method: string;
  conclusion: string;
}

// · 审核结果
interface ReviewResult {
  field: string;
  reporter: string;
  date: string;
  background: string;
  coreContents: CoreContent[];
  innovation: string;
  trend: string;
  thoughts: string;
}

const STORAGE_KEY = "literature-review-data"; // 本地存储键名
const USER_ID_KEY = "literature-review-user-id"; // 用户唯一标识
const USER_NAME_KEY = "literature-review-user-name"; // 用户姓名
const SAVED_REVIEW_ID_KEY = "literature-review-saved-id"; // 最近保存到服务器的 review id
// AI 生成的 per-paper 核心内容 (summary/method/conclusion) 服务端 schema 没存,
// 改用 localStorage 按 reviewId 索引缓存,这样 "打开归档" 仍能恢复 AI 解析结果
const CORE_CONTENTS_CACHE_KEY = "literature-review-core-contents";

const isDragging = ref(false); // 是否正在拖动
const papers = ref<Paper[]>([]); // 文献条目列表
const generating = ref(false); // 是否正在生成
const reviewResult = ref<ReviewResult | null>(null); // 审核结果
const previewPaper = ref<Paper | null>(null); // 预览文献条目

// 用户标识
const userId = ref("");
const userName = ref("");
// 归档列表
interface ArchiveItem {
  id: string;
  user_id: string;
  user_name?: string;
  field?: string;
  reporter?: string;
  review_date?: string;
  created_at: number;
  updated_at: number;
  paper_count: number;
}
const archiveList = ref<ArchiveItem[]>([]); // 归档列表
const archiveLoading = ref(false); // 归档列表加载状态
const savingArchive = ref(false); // 是否正在保存到归档
const showArchive = ref(false); // 是否显示归档列表

// 审计日志
interface AuditItem {
  id: string;
  review_id: string;
  user_id: string;
  user_name?: string;
  action: string;
  detail?: string;
  created_at: number;
}
const auditList = ref<AuditItem[]>([]); // 审计日志列表
const auditLoading = ref(false); // 审计日志列表加载状态
const showAudit = ref(false); // 是否显示审计日志列表

// 生成稳定的用户 id（首次访问时创建，存 localStorage）
function ensureUserId() {
  if (typeof window === "undefined") return;
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id =
      "u_" +
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 10);
    localStorage.setItem(USER_ID_KEY, id);
  }
  userId.value = id;
  userName.value = localStorage.getItem(USER_NAME_KEY) || "";
}

function saveUserName() {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_NAME_KEY, userName.value.trim());
}

// 加载归档列表
async function loadArchiveList() {
  // 走 admin JWT 鉴权:未登录直接 return,避免 401
  if (!isLoggedIn.value) return;
  if (!userId.value) return;
  archiveLoading.value = true;
  try {
    const res: any = await $fetch("/api/literature-review/list", {
      query: { userId: userId.value },
    });
    archiveList.value = res.data || [];
  } catch (err) {
    logger.warn("加载归档失败:", err);
    archiveList.value = [];
  } finally {
    archiveLoading.value = false;
  }
}

// 保存当前 review 到服务器
async function saveToArchive() {
  if (!reviewResult.value) return;
  if (!isLoggedIn.value) {
    alert("请先登录后再保存到归档");
    return;
  }
  if (!userId.value) {
    ensureUserId();
  }
  savingArchive.value = true;
  try {
    // 最多自动重试 1 次(用于跨账号后 localStorage 还残留旧 reviewId 的场景)
    const staleRetry = { used: false };
    const doSave = async (reviewId?: string) => {
      const res: any = await $fetch("/api/literature-review/save", {
        method: "POST",
        body: {
          userId: userId.value,
          userName: userName.value.trim() || undefined,
          reviewId,
          field: reviewResult.value!.field,
          background: reviewResult.value!.background,
          innovation: reviewResult.value!.innovation,
          trend: reviewResult.value!.trend,
          thoughts: reviewResult.value!.thoughts,
          reporter: reviewResult.value!.reporter,
          date: reviewResult.value!.date,
          papers: papers.value.map((p) => ({
            name: p.name,
            size: p.size,
            content: p.content,
            htmlContent: p.htmlContent,
            isPdf: p.isPdf,
            isDocx: p.isDocx,
            isDoc: p.isDoc,
          })),
        },
      });
      return res;
    };

    let res: any;
    const savedId = localStorage.getItem(SAVED_REVIEW_ID_KEY) || undefined;
    try {
      res = await doSave(savedId);
    } catch (err: any) {
      // 403 + data.reason === 'stale_saved_id' = localStorage 残留了别的账号的 reviewId
      // 清掉后作为新建重试一次
      if (
        err?.statusCode === 403 &&
        err?.data?.reason === "stale_saved_id" &&
        savedId &&
        !staleRetry.used
      ) {
        staleRetry.used = true;
        localStorage.removeItem(SAVED_REVIEW_ID_KEY);
        res = await doSave(undefined);
      } else {
        throw err;
      }
    }

    if (res.id) {
      localStorage.setItem(SAVED_REVIEW_ID_KEY, res.id);
      // 把 AI 生成的 per-paper 核心内容按 reviewId 索引存到 localStorage,
      // 下次 loadFromArchive 读这个 cache 把 summary/method/conclusion 补回来
      cacheCoreContents(res.id, reviewResult.value!.coreContents);
    }
    await loadArchiveList();
  } catch (err: any) {
    alert("保存到服务器失败：" + (err.message || "未知错误"));
  } finally {
    savingArchive.value = false;
  }
}

// 读取 coreContents 缓存:{ [reviewId]: CoreContent[] }
function readCoreContentsCache(): Record<string, CoreContent[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CORE_CONTENTS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CoreContent[]>) : {};
  } catch {
    return {};
  }
}

// 写入 coreContents 缓存
function cacheCoreContents(reviewId: string, contents: CoreContent[]) {
  if (typeof window === "undefined") return;
  const cache = readCoreContentsCache();
  cache[reviewId] = contents;
  try {
    localStorage.setItem(CORE_CONTENTS_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    // localStorage 配额超限静默处理
    logger.warn("coreContents 缓存写入失败:", err);
  }
}

// 从归档恢复
async function loadFromArchive(id: string) {
  try {
    const res: any = await $fetch(`/api/literature-review/${id}`, {
      query: { userId: userId.value },
    });
    const data = res.data;
    if (!data) return;

    // 恢复 papers（计算 contentHash 用于后续去重）
    papers.value = await Promise.all(
      (data.papers || []).map(async (p: any) => ({
        id: p.id || Math.random().toString(36).substring(2, 9),
        name: p.name,
        size: p.size,
        content: p.content || "",
        contentHash: await computeHash(p.content || ""),
        htmlContent: p.htmlContent || "",
        isPdf: p.isPdf,
        isDocx: p.isDocx,
        isDoc: p.isDoc,
      })),
    );

    // 恢复 review
    // 1. 先用服务端 papers 列表搭骨架(title = 文件名,AI 字段留空)
    // 2. 再从 localStorage cache 按 reviewId 找回 AI 生成的 summary/method/conclusion
    //    (服务端 schema 没存这些字段,这是当前架构下的妥协方案)
    const baseContents: CoreContent[] = (data.papers || []).map((p: any) => ({
      title: p.name,
      summary: "",
      method: "",
      conclusion: "",
    }));
    const cache = readCoreContentsCache();
    const cached = cache[id];
    const coreContents: CoreContent[] = baseContents.map((base, idx) => {
      const hit = cached?.[idx];
      if (!hit) return base;
      return {
        title: hit.title || base.title,
        summary: hit.summary || "",
        method: hit.method || "",
        conclusion: hit.conclusion || "",
      };
    });

    reviewResult.value = {
      field: data.field || "",
      reporter: data.reporter || "",
      date: data.review_date || new Date().toISOString().split("T")[0],
      background: data.background || "",
      coreContents,
      innovation: data.innovation || "",
      trend: data.trend || "",
      thoughts: data.thoughts || "",
    };

    localStorage.setItem(SAVED_REVIEW_ID_KEY, id);
    saveToStorage();
    showArchive.value = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err: any) {
    alert("加载归档失败：" + (err.message || "未知错误"));
  }
}

// 删除归档
async function deleteArchive(id: string) {
  if (!confirm("确定要删除这条归档吗？此操作不可恢复。")) return;
  try {
    await $fetch(`/api/literature-review/${id}`, {
      method: "DELETE",
      query: { userId: userId.value },
    });
    if (localStorage.getItem(SAVED_REVIEW_ID_KEY) === id) {
      localStorage.removeItem(SAVED_REVIEW_ID_KEY);
    }
    // 同步清掉 localStorage 里这份归档对应的 coreContents 缓存
    const cache = readCoreContentsCache();
    if (id in cache) {
      delete cache[id];
      localStorage.setItem(CORE_CONTENTS_CACHE_KEY, JSON.stringify(cache));
    }
    await loadArchiveList();
  } catch (err: any) {
    alert("删除失败：" + (err.message || "未知错误"));
  }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 加载审计日志
async function loadAuditList() {
  if (!isLoggedIn.value) return;
  if (!userId.value) return;
  auditLoading.value = true;
  try {
    const res: any = await $fetch("/api/literature-review/audit", {
      query: { userId: userId.value, limit: 100 },
    });
    auditList.value = res.data || [];
  } catch {
    auditList.value = [];
  } finally {
    auditLoading.value = false;
  }
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create: "创建",
    update: "更新",
    delete: "删除",
  };
  return map[action] || action;
}

function actionColor(action: string): string {
  const map: Record<string, string> = {
    create: "text-emerald-600",
    update: "text-blue-600",
    delete: "text-red-500",
  };
  return map[action] || "text-stone-600";
}

// 打开预览
function openPreview(paper: Paper) {
  previewPaper.value = paper;
  document.body.style.overflow = "hidden";
}

// 关闭预览
function closePreview() {
  previewPaper.value = null;
  document.body.style.overflow = "";
}

// 从 localStorage 加载数据
function loadFromStorage() {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.papers) papers.value = parsed.papers;
    if (parsed.reviewResult) reviewResult.value = parsed.reviewResult;
  }
}

// 保存到 localStorage
// 注意：仅持久化元数据，content/blobUrl 不存（content 可能数十万字符撑爆配额，blobUrl 刷新即失效）
function saveToStorage() {
  if (typeof window === "undefined") return;
  try {
    const slimPapers = papers.value.map((p) => ({
      id: p.id,
      name: p.name,
      size: p.size,
      contentHash: p.contentHash,
      isPdf: p.isPdf,
      isDocx: p.isDocx,
      isDoc: p.isDoc,
      // docx 渲染的 HTML 用于预览，可保留（通常较小）
      htmlContent: p.htmlContent,
      // 仅当文本较小（<20k）时才持久化 content，否则置空以避免超限
      content: p.content && p.content.length < 20000 ? p.content : "",
    }));
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        papers: slimPapers,
        reviewResult: reviewResult.value,
      }),
    );
  } catch (err) {
    // 配额超限或其他存储错误静默处理，不阻塞主流程
    logger.warn("localStorage 保存失败:", err);
  }
}

// 初始化加载
// 重要:这两个调用读 localStorage,必须在 onMounted 里执行,不能直接放 setup 顶层。
// 否则 setup 阶段 client 同步读 localStorage 立刻改了 papers/reviewResult/userName,
// 跟 server SSR (typeof window === 'undefined' 直接 return,ref 全是空) 不一致,
// 触发 hydration mismatch
onMounted(() => {
  loadFromStorage();
  ensureUserId();
  recheckAuth();
});
// 归档接口需要 admin JWT,直接调用在 setup 阶段会撞 401(default layout 的
// onMounted(checkAuth) 还没跑完,登录态此时一定是 false)
// 用 watch 等登录态确定后再加载;同时登录后也会自动刷新归档列表
watch(
  currentUser,
  (u) => {
    if (u.isLoggedIn) {
      loadArchiveList();
      loadAuditList();
    }
  },
  { immediate: false },
);

// 生成唯一ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// 计算文本内容的 SHA-256 hash（用于重复检测）
async function computeHash(text: string): Promise<string> {
  if (!text) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// 读取文件内容为文本
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// 读取文件为 ArrayBuffer 并生成 Blob URL
function readFileAsBlobUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) return reject(new Error("读取失败"));
      const blob = new Blob([arrayBuffer], {
        type: file.type || "application/octet-stream",
      });
      resolve(URL.createObjectURL(blob));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// 动态加载 mammoth（仅在需要解析 .docx 时）
function loadMammoth(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.mammoth) return resolve(w.mammoth);
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js";
    script.onload = () => resolve(w.mammoth);
    script.onerror = () => reject(new Error("mammoth 加载失败"));
    document.head.appendChild(script);
  });
}

// 将 .docx 解析为 HTML
async function readDocxAsHtml(
  file: File,
): Promise<{ html: string; text: string }> {
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  // 同时提取纯文本供后续摘要使用
  const textResult = await mammoth.extractRawText({ arrayBuffer });
  return { html: result.value, text: textResult.value };
}

// 处理文件选择
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  await processFiles(Array.from(input.files));
  input.value = "";
}

// 处理拖拽
async function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const files = Array.from(event.dataTransfer?.files || []);
  await processFiles(files);
}

// 处理文件列表
async function processFiles(files: File[]) {
  const validFiles = files.filter((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    return ["txt", "md", "pdf", "doc", "docx"].includes(ext || "");
  });

  let duplicateCount = 0;

  for (const file of validFiles) {
    try {
      const lowerName = file.name.toLowerCase();
      const isPdf = lowerName.endsWith(".pdf");
      const isDocx = lowerName.endsWith(".docx");
      const isDoc = lowerName.endsWith(".doc");

      let content = "";
      let blobUrl: string | undefined;
      let htmlContent: string | undefined;

      if (isPdf) {
        content = await readFile(file);
        blobUrl = await readFileAsBlobUrl(file);
      } else if (isDocx) {
        const { html, text } = await readDocxAsHtml(file);
        htmlContent = html;
        content = text;
        blobUrl = await readFileAsBlobUrl(file);
      } else if (isDoc) {
        blobUrl = await readFileAsBlobUrl(file);
        content =
          "该文件为 .doc 旧版 Word 格式，无法直接预览文本内容。请下载后用 Word 打开。";
      } else {
        content = await readFile(file);
      }

      // 重复检测：文件名 + 内容 hash 双重校验
      const contentHash = await computeHash(content);
      const isDuplicate = papers.value.some(
        (p) =>
          p.contentHash === contentHash ||
          (p.name === file.name && p.size === file.size),
      );
      if (isDuplicate) {
        duplicateCount++;
        continue;
      }

      papers.value.push({
        id: generateId(),
        name: file.name,
        size: file.size,
        content,
        contentHash,
        blobUrl,
        isPdf,
        isDocx,
        isDoc,
        htmlContent,
      });
    } catch (err) {
      logger.error("处理文件失败:", file.name, err);
    }
  }

  if (duplicateCount > 0) {
    alert(`已跳过 ${duplicateCount} 篇重复文献（同名或内容相同）。`);
  }

  saveToStorage();
}

// 删除单篇文献
function removePaper(index: number) {
  papers.value.splice(index, 1);
  reviewResult.value = null;
  saveToStorage();
}

// 清空全部
function clearAll() {
  papers.value = [];
  reviewResult.value = null;
  // 清空 = 重新开始,下一份 save 应当创建新归档,不能复用旧的 reviewId 去 UPSERT
  if (typeof window !== "undefined") {
    localStorage.removeItem(SAVED_REVIEW_ID_KEY);
  }
  saveToStorage();
}

// 生成综述
async function generateReview() {
  if (papers.value.length === 0) return;
  // 生成接口需要 review:generate 权限(走 middleware 拦截)
  if (!isLoggedIn.value) {
    alert("请先登录后再生成综述");
    return;
  }

  // 过滤掉刷新后丢失 content 的文献，提示用户重新上传
  const available = papers.value.filter(
    (p) => p.content && p.content.trim().length > 0,
  );
  if (available.length === 0) {
    alert(
      "文献内容已失效（刷新页面后大文本不会保留），请重新上传文件后再生成综述。",
    );
    return;
  }
  const skipped = papers.value.length - available.length;
  if (skipped > 0) {
    alert(`已自动跳过 ${skipped} 篇内容已失效的文献，请重新上传。`);
  }

  generating.value = true;

  try {
    const res: any = await $fetch("/api/literature-review", {
      method: "POST",
      body: {
        papers: available.map((p) => ({
          name: p.name,
          content: p.content,
        })),
      },
    });

    const data = res.data || res;

    reviewResult.value = {
      field: data.field || "",
      // 顶部 userName 兜底:用户填了顶部"汇报人"但没在综述里改的话,这里带过去,
      // 避免"汇报人信息没有包含到相关内容中"。如果用户在综述结果里手动改过,
      // reviewResult.value?.reporter 非空,优先用用户的输入
      reporter: reviewResult.value?.reporter || userName.value.trim() || "",
      date:
        reviewResult.value?.date ||
        new Date().toISOString().split("T")[0] ||
        "",
      background: data.background || "",
      coreContents: data.coreContents || [],
      innovation: data.innovation || "",
      trend: data.trend || "",
      thoughts: "",
    };

    saveToStorage();
    // 自动持久化到服务器
    await saveToArchive();
  } catch (error: any) {
    alert(error.message || "生成失败，请重试");
  } finally {
    generating.value = false;
  }
}

// 添加核心内容条目
function addCoreItem() {
  reviewResult.value?.coreContents.push({
    title: "",
    summary: "",
    method: "",
    conclusion: "",
  });
  saveToStorage();
}

// 删除核心内容条目
function removeCoreItem(index: number) {
  reviewResult.value?.coreContents.splice(index, 1);
  saveToStorage();
}

// 复制结果
async function copyResult() {
  if (!reviewResult.value) return;
  const text = generateMarkdown(reviewResult.value);
  await navigator.clipboard.writeText(text);
  alert("已复制到剪贴板");
}

// 导出 Markdown
function exportMarkdown() {
  if (!reviewResult.value) return;
  const text = generateMarkdown(reviewResult.value);
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `文献综述_${reviewResult.value.date || new Date().toISOString().split("T")[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// 生成 Markdown 文本
function generateMarkdown(result: ReviewResult): string {
  const lines: string[] = [];
  lines.push(`# 文献综述汇报`);
  lines.push("");
  lines.push(`**研究领域：** ${result.field || "未填写"}`);
  lines.push(`**汇报人：** ${result.reporter || "未填写"}`);
  lines.push(`**汇报日期：** ${result.date || "未填写"}`);
  lines.push(`**文献数量：** ${papers.value.length} 篇`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 一、研究背景与意义");
  lines.push("");
  lines.push(result.background || "暂无内容");
  lines.push("");
  lines.push("## 二、核心内容梳理");
  lines.push("");
  result.coreContents.forEach((item, idx) => {
    lines.push(`### ${idx + 1}. ${item.title || "未命名文献"}`);
    lines.push("");
    lines.push("**内容摘要：**");
    lines.push(item.summary || "暂无");
    lines.push("");
    lines.push("**研究方法：** " + (item.method || "暂无"));
    lines.push("**主要结论：** " + (item.conclusion || "暂无"));
    lines.push("");
  });
  lines.push("## 三、创新点与对比分析");
  lines.push("");
  lines.push(result.innovation || "暂无内容");
  lines.push("");
  lines.push("## 四、研究趋势与展望");
  lines.push("");
  lines.push(result.trend || "暂无内容");
  lines.push("");
  lines.push("## 五、个人思考与启发");
  lines.push("");
  lines.push(result.thoughts || "暂无内容");
  lines.push("");
  return lines.join("\n");
}
</script>

<style scoped>
/* docx 预览样式：mammoth 输出的 HTML 节点美化 */
.docx-preview {
  color: #1c1917;
  line-height: 1.75;
  font-size: 15px;
  max-width: 820px;
  margin: 0 auto;
}
.docx-preview :deep(h1) {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem;
  color: #0c0a09;
  border-bottom: 1px solid #e7e5e4;
  padding-bottom: 0.5rem;
}
.docx-preview :deep(h2) {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem;
  color: #1c1917;
}
.docx-preview :deep(h3) {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #292524;
}
.docx-preview :deep(p) {
  margin: 0 0 0.85rem;
  text-align: justify;
}
.docx-preview :deep(ul),
.docx-preview :deep(ol) {
  margin: 0 0 0.85rem 1.5rem;
}
.docx-preview :deep(li) {
  margin-bottom: 0.35rem;
}
.docx-preview :deep(strong) {
  font-weight: 600;
  color: #0c0a09;
}
.docx-preview :deep(em) {
  font-style: italic;
  color: #44403c;
}
.docx-preview :deep(a) {
  color: #44403c;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.docx-preview :deep(table) {
  border-collapse: collapse;
  margin: 1rem 0;
  width: 100%;
  font-size: 0.9rem;
}
.docx-preview :deep(table td),
.docx-preview :deep(table th) {
  border: 1px solid #d6d3d1;
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.docx-preview :deep(table th) {
  background: #f5f5f4;
  font-weight: 600;
}
.docx-preview :deep(blockquote) {
  border-left: 3px solid #a8a29e;
  padding: 0.25rem 1rem;
  margin: 0.85rem 0;
  color: #57534e;
  background: #fafaf9;
}
.docx-preview :deep(img) {
  max-width: 100%;
  height: auto;
  margin: 0.75rem 0;
  border-radius: 6px;
}

/* 模态框淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
