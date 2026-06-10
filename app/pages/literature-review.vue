<template>
  <div>
    <!-- 标题区 -->
    <div class="mb-10">
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
          <label class="text-stone-900 underline underline-offset-2 cursor-pointer hover:text-stone-600 transition-colors">
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
    <div v-if="papers.length > 0" class="mb-8 space-y-3">
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
          <span class="text-xs font-medium text-stone-500">{{ index + 1 }}</span>
        </div>
        <div class="flex-1 min-w-0 cursor-pointer" @click="openPreview(paper)">
          <p class="text-sm font-medium text-stone-700 truncate group-hover:text-stone-900 transition-colors">
            {{ paper.name }}
          </p>
          <p class="text-xs text-stone-400 mt-0.5">
            {{ formatSize(paper.size) }} · {{ paper.content.length }} 字
          </p>
        </div>
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all"
          title="预览"
          @click="openPreview(paper)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
          @click="removePaper(index)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
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
          <div class="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" @click="closePreview"></div>

          <!-- 内容区 -->
          <div class="relative w-full max-w-5xl h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <!-- 头部 -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div class="min-w-0">
                  <h3 class="text-sm font-semibold text-stone-800 truncate">{{ previewPaper.name }}</h3>
                  <p class="text-xs text-stone-400">{{ formatSize(previewPaper.size) }} · {{ previewPaper.content.length }} 字</p>
                </div>
              </div>
              <button
                class="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all shrink-0"
                @click="closePreview"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
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
              <!-- 非 PDF 用文本预览 -->
              <div v-else class="h-full overflow-y-auto p-6">
                <pre class="whitespace-pre-wrap text-sm text-stone-700 leading-relaxed font-sans">{{ previewPaper.content }}</pre>
              </div>
            </div>

            <!-- 底部 -->
            <div class="px-6 py-3 border-t border-stone-100 shrink-0 flex justify-end">
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
    <div v-if="papers.length > 0" class="mb-10">
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
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{{ generating ? '正在生成综述...' : '生成文献综述' }}</span>
      </button>
    </div>

    <!-- 综述结果 -->
    <div v-if="reviewResult" class="space-y-6">
      <!-- 操作栏 -->
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-stone-800">综述结果</h2>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5"
            @click="copyResult"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            复制
          </button>
          <button
            class="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5"
            @click="exportMarkdown"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出 Markdown
          </button>
        </div>
      </div>

      <!-- 综述卡片 -->
      <div class="bg-white border border-stone-200/60 rounded-2xl overflow-hidden">
        <!-- 基本信息 -->
        <div class="p-6 border-b border-stone-100">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-stone-500 mb-1.5">研究领域</label>
              <input
                v-model="reviewResult.field"
                type="text"
                class="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
                placeholder="填写研究领域"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-stone-500 mb-1.5">汇报人</label>
              <input
                v-model="reviewResult.reporter"
                type="text"
                class="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
                placeholder="填写汇报人姓名"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-stone-500 mb-1.5">汇报日期</label>
              <input
                v-model="reviewResult.date"
                type="date"
                class="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-stone-500 mb-1.5">文献数量</label>
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
              <h3 class="text-sm font-semibold text-stone-700">研究背景与意义</h3>
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
              <h3 class="text-sm font-semibold text-stone-700">核心内容梳理</h3>
            </div>
            <div class="space-y-3">
              <div
                v-for="(item, idx) in reviewResult.coreContents"
                :key="idx"
                class="bg-stone-50 border border-stone-200 rounded-xl p-4"
              >
                <div class="flex items-start gap-3">
                  <span class="w-6 h-6 rounded-md bg-stone-200 flex items-center justify-center text-xs font-medium text-stone-600 shrink-0 mt-0.5">{{ idx + 1 }}</span>
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
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                class="w-full py-2 border border-dashed border-stone-300 rounded-xl text-xs text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-all flex items-center justify-center gap-1.5"
                @click="addCoreItem"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
                </svg>
                添加文献条目
              </button>
            </div>
          </div>

          <!-- 创新点对比 -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <div class="w-1 h-4 bg-stone-400 rounded-full"></div>
              <h3 class="text-sm font-semibold text-stone-700">创新点与对比分析</h3>
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
              <h3 class="text-sm font-semibold text-stone-700">研究趋势与展望</h3>
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
              <h3 class="text-sm font-semibold text-stone-700">个人思考与启发</h3>
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
  </div>
</template>

<script setup lang="ts">
// · 文献条目
interface Paper {
  id: string;
  name: string;
  size: number;
  content: string;
  blobUrl?: string;
  isPdf?: boolean;
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

const STORAGE_KEY = 'literature-review-data'; // 本地存储键名

const isDragging = ref(false); // 是否正在拖动
const papers = ref<Paper[]>([]); // 文献条目列表
const generating = ref(false); // 是否正在生成
const reviewResult = ref<ReviewResult | null>(null); // 审核结果
const previewPaper = ref<Paper | null>(null); // 预览文献条目

// 打开预览
function openPreview(paper: Paper) {
  previewPaper.value = paper;
  document.body.style.overflow = 'hidden';
}

// 关闭预览
function closePreview() {
  previewPaper.value = null;
  document.body.style.overflow = '';
}

// 从 localStorage 加载数据
function loadFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.papers) papers.value = parsed.papers;
      if (parsed.reviewResult) reviewResult.value = parsed.reviewResult;
    }
  } catch {
    // 忽略解析错误
  }
}

// 保存到 localStorage
function saveToStorage() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      papers: papers.value,
      reviewResult: reviewResult.value,
    })
  );
}

// 初始化加载
loadFromStorage();

// 生成唯一ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 读取文件内容为文本
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
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
      if (!arrayBuffer) return reject(new Error('读取失败'));
      const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });
      resolve(URL.createObjectURL(blob));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// 处理文件选择
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  await processFiles(Array.from(input.files));
  input.value = '';
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
    const ext = f.name.split('.').pop()?.toLowerCase();
    return ['txt', 'md', 'pdf', 'doc', 'docx'].includes(ext || '');
  });

  for (const file of validFiles) {
    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const content = await readFile(file);
      let blobUrl: string | undefined;
      if (isPdf) {
        blobUrl = await readFileAsBlobUrl(file);
      }
      papers.value.push({
        id: generateId(),
        name: file.name,
        size: file.size,
        content: content.slice(0, 30000), // 限制长度
        blobUrl,
        isPdf,
      });
    } catch {
      // 忽略读取失败的文件
    }
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
  saveToStorage();
}

// 生成综述
async function generateReview() {
  if (papers.value.length === 0) return;
  generating.value = true;

  try {
    const res: any = await $fetch('/api/literature-review', {
      method: 'POST',
      body: {
        papers: papers.value.map((p) => ({
          name: p.name,
          content: p.content,
        })),
      },
    });

    const data = res.data || res;

    reviewResult.value = {
      field: data.field || '',
      reporter: reviewResult.value?.reporter || '',
      date: reviewResult.value?.date || new Date().toISOString().split('T')[0] || '',
      background: data.background || '',
      coreContents: data.coreContents || [],
      innovation: data.innovation || '',
      trend: data.trend || '',
      thoughts: '',
    };

    saveToStorage();
  } catch (error: any) {
    alert(error.message || '生成失败，请重试');
  } finally {
    generating.value = false;
  }
}

// 添加核心内容条目
function addCoreItem() {
  reviewResult.value?.coreContents.push({
    title: '',
    summary: '',
    method: '',
    conclusion: '',
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
  alert('已复制到剪贴板');
}

// 导出 Markdown
function exportMarkdown() {
  if (!reviewResult.value) return;
  const text = generateMarkdown(reviewResult.value);
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `文献综述_${reviewResult.value.date || new Date().toISOString().split('T')[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// 生成 Markdown 文本
function generateMarkdown(result: ReviewResult): string {
  const lines: string[] = [];
  lines.push(`# 文献综述汇报`);
  lines.push('');
  lines.push(`**研究领域：** ${result.field || '未填写'}`);
  lines.push(`**汇报人：** ${result.reporter || '未填写'}`);
  lines.push(`**汇报日期：** ${result.date || '未填写'}`);
  lines.push(`**文献数量：** ${papers.value.length} 篇`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 一、研究背景与意义');
  lines.push('');
  lines.push(result.background || '暂无内容');
  lines.push('');
  lines.push('## 二、核心内容梳理');
  lines.push('');
  result.coreContents.forEach((item, idx) => {
    lines.push(`### ${idx + 1}. ${item.title || '未命名文献'}`);
    lines.push('');
    lines.push('**内容摘要：**');
    lines.push(item.summary || '暂无');
    lines.push('');
    lines.push('**研究方法：** ' + (item.method || '暂无'));
    lines.push('**主要结论：** ' + (item.conclusion || '暂无'));
    lines.push('');
  });
  lines.push('## 三、创新点与对比分析');
  lines.push('');
  lines.push(result.innovation || '暂无内容');
  lines.push('');
  lines.push('## 四、研究趋势与展望');
  lines.push('');
  lines.push(result.trend || '暂无内容');
  lines.push('');
  lines.push('## 五、个人思考与启发');
  lines.push('');
  lines.push(result.thoughts || '暂无内容');
  lines.push('');
  return lines.join('\n');
}
</script>

<style scoped>
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
