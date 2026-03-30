<template>
  <div class="h-[calc(100vh-220px)] flex flex-col">
    <!-- 精致头部 -->
    <header class="flex items-center justify-between pb-5 border-b border-stone-200/60">
      <div class="flex items-center gap-4">
        <div 
          class="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300"
          :class="useRAG ? 'bg-linear-to-br from-emerald-500 to-emerald-700 shadow-emerald-200' : 'bg-linear-to-br from-stone-700 to-stone-900 shadow-stone-200'"
        >
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="useRAG" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-semibold text-stone-800">{{ useRAG ? '知识库对话' : 'AI 对话' }}</h1>
          <p class="text-xs text-stone-500 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {{ useRAG ? '基于博客知识库的智能问答' : (configStatus?.model || '准备就绪') }}
          </p>
        </div>
      </div>
      
      <!-- RAG 开关 - 改进样式 -->
      <div class="flex items-center gap-3 bg-stone-100/80 rounded-full px-4 py-2">
        <span class="text-xs font-medium text-stone-600">知识库</span>
        <button
          @click="useRAG = !useRAG"
          :class="useRAG ? 'bg-emerald-500' : 'bg-stone-300'"
          class="relative w-12 h-6 rounded-full transition-all duration-300 ease-out"
        >
          <span
            :class="useRAG ? 'translate-x-6' : 'translate-x-0.5'"
            class="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ease-out flex items-center justify-center"
          >
            <svg v-if="useRAG" class="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </span>
        </button>
      </div>
    </header>

    <!-- 消息列表 -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto py-6 space-y-5 scroll-smooth">
      <!-- 欢迎消息 -->
      <Transition name="fade-scale">
        <div v-if="messages.length === 0" class="text-center py-16">
          <div class="w-20 h-20 bg-linear-to-br from-stone-100 to-stone-200 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
            <svg class="w-10 h-10 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
          </div>
          <h3 class="text-stone-700 font-medium text-lg mb-2">{{ useRAG ? '开始知识库对话' : '开始 AI 对话' }}</h3>
          <p class="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">
            {{ useRAG ? '基于博客知识库，为你提供精准的智能问答服务' : '与 AI 助手自由交流，探索无限可能' }}
          </p>
          <!-- 快捷提示 -->
          <div v-if="useRAG" class="mt-6 flex flex-wrap justify-center gap-2">
            <button 
              v-for="tip in quickTips" 
              :key="tip"
              @click="inputMessage = tip"
              class="px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs text-stone-600 hover:border-emerald-300 hover:text-emerald-600 transition-all"
            >
              {{ tip }}
            </button>
          </div>
        </div>
      </Transition>

      <!-- 消息项 -->
      <TransitionGroup name="message">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          v-show="!(msg.role === 'assistant' && !msg.content && loading)"
          class="flex animate-slide-in"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div class="flex max-w-[88%] gap-3" :class="msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'">
            <!-- 头像 -->
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
              :class="msg.role === 'user' 
                ? 'bg-linear-to-br from-stone-700 to-stone-800' 
                : 'bg-linear-to-br from-emerald-500 to-emerald-600'"
            >
              <span class="text-xs font-semibold text-white">
                {{ msg.role === 'user' ? '我' : 'AI' }}
              </span>
            </div>

            <!-- 消息内容 -->
            <div class="flex flex-col min-w-0">
              <!-- 引用来源 (仅 AI 消息) -->
              <Transition name="fade">
                <div 
                  v-if="msg.role === 'assistant' && msg.sources && msg.sources.length > 0" 
                  class="mb-2 px-4 py-2.5 bg-linear-to-r from-emerald-50/80 to-emerald-50 border border-emerald-100 rounded-t-2xl rounded-br-sm"
                >
                  <p class="text-xs text-emerald-600 mb-1.5 font-medium flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    参考来源
                  </p>
                  <div class="flex flex-wrap gap-1.5">
                    <NuxtLink
                      v-for="source in msg.sources"
                      :key="source.path"
                      :to="source.path"
                      class="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-emerald-700 rounded-lg text-xs hover:bg-emerald-100 transition-all shadow-sm border border-emerald-100/50"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      {{ source.title }}
                    </NuxtLink>
                  </div>
                </div>
              </Transition>

              <div
                class="px-4 py-3 text-sm leading-relaxed shadow-sm"
                :class="[
                  msg.role === 'user' 
                    ? 'bg-linear-to-br from-stone-800 to-stone-900 text-white rounded-2xl rounded-br-md' 
                    : 'bg-white border border-stone-200 text-stone-700 rounded-2xl rounded-bl-md',
                  msg.sources && msg.sources.length > 0 ? 'rounded-tl-sm' : ''
                ]"
              >
                <div v-if="msg.role === 'assistant'" class="prose prose-sm max-w-none prose-stone">
                  <div v-html="formatMessage(msg.content)"></div>
                </div>
                <p v-else class="whitespace-pre-wrap">{{ msg.content }}</p>
              </div>
              
              <!-- 时间戳 -->
              <span class="text-[11px] mt-1.5 text-stone-400 font-medium" :class="msg.role === 'user' ? 'text-right mr-1' : 'text-left ml-1'">
                {{ formatTime(msg.time) }}
              </span>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- 加载状态 - 改进样式 -->
      <Transition name="fade">
        <div v-if="loading && !streaming" class="flex justify-start">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <span class="text-xs font-semibold text-white">AI</span>
            </div>
            <div class="bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div class="flex items-center gap-1.5">
                <div class="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"/>
                <div class="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-100"/>
                <div class="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-200"/>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 输入区域 - 改进样式 -->
    <div class="border-t border-stone-200/60 pt-5">
      <div class="relative group">
        <div class="absolute -inset-0.5 bg-linear-to-r from-stone-200 to-stone-300 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur"></div>
        <div class="relative flex items-end gap-2 bg-white border border-stone-200 rounded-xl p-2 focus-within:border-stone-400 focus-within:shadow-lg transition-all duration-300">
          <textarea
            v-model="inputMessage"
            rows="1"
            :placeholder="useRAG ? '输入问题，基于博客知识库回答...' : '输入消息开始对话...'"
            class="flex-1 px-3 py-2.5 text-sm resize-none focus:outline-none bg-transparent max-h-32"
            @keydown="handleKeydown"
            @input="autoResize"
            ref="inputRef"
            :disabled="loading"
          />
          <button
            @click="sendMessage"
            :disabled="!inputMessage.trim() || loading"
            class="p-2.5 bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md active:scale-95"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </button>
        </div>
      </div>
      <p class="text-xs text-stone-400 mt-3 text-center flex items-center justify-center gap-2">
        <span class="flex items-center gap-1">
          <kbd class="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] font-sans border border-stone-200">Enter</kbd>
          发送
        </span>
        <span class="text-stone-300">·</span>
        <span class="flex items-center gap-1">
          <kbd class="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] font-sans border border-stone-200">Shift</kbd>
          +
          <kbd class="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] font-sans border border-stone-200">Enter</kbd>
          换行
        </span>
        <span class="text-stone-300">·</span>
        <span :class="useRAG ? 'text-emerald-600 font-medium' : ''">
          {{ useRAG ? '知识库模式已启用' : '普通对话模式' }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup>
const messages = ref([])
const inputMessage = ref('')
const loading = ref(false)
const streaming = ref(false)
const useRAG = ref(true)
const messagesContainer = ref(null)
const inputRef = ref(null)

// 快捷提示
const quickTips = [
  '博客的主要内容是什么？',
  '介绍一下相关技术',
  '总结一下核心观点',
  '有什么实践建议？'
]

// 获取配置状态
const { data: configStatus } = await useFetch('/api/ai-config')

// 格式化时间
const formatTime = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

// 格式化消息内容（简单的 markdown 渲染）
const formatMessage = (content) => {
  if (!content) return ''
  // 转义 HTML
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // 代码块
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre class="bg-stone-100 rounded-lg p-3 overflow-x-auto my-2 text-xs"><code>$1</code></pre>')
  
  // 行内代码
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-stone-100 px-1.5 py-0.5 rounded text-xs text-stone-700">$1</code>')
  
  // 粗体
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-stone-800">$1</strong>')
  
  // 斜体
  formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
  
  // 换行
  formatted = formatted.replace(/\n/g, '<br>')
  
  return formatted
}

// 自动调整输入框高度
const autoResize = () => {
  const textarea = inputRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px'
  }
}

// 处理键盘事件
const handleKeydown = (e) => {
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      return
    }
    e.preventDefault()
    sendMessage()
  }
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

// 发送消息
const sendMessage = async () => {
  const message = inputMessage.value.trim()
  if (!message || loading.value) return

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: message,
    time: Date.now()
  })

  inputMessage.value = ''
  loading.value = true
  streaming.value = false
  
  // 重置输入框高度
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }
  
  scrollToBottom()

  // 准备历史消息
  const history = messages.value
    .filter(m => m.role !== 'system')
    .slice(-10)
    .map(m => ({
      role: m.role,
      content: m.content
    }))

  try {
    const apiEndpoint = useRAG.value ? '/api/rag-chat' : '/api/aichat-stream'
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history,
        useRAG: useRAG.value
      })
    })

    if (!response.ok) {
      throw new Error('请求失败')
    }

    // 获取引用来源（从响应头）
    let sources = []
    if (useRAG.value) {
      const sourcesHeader = response.headers.get('X-Context-Sources')
      if (sourcesHeader) {
        try {
          sources = JSON.parse(decodeURIComponent(sourcesHeader))
        } catch (e) {
          console.error('解析来源失败:', e)
        }
      }
    }

    // 创建 AI 消息占位
    const aiMessageIndex = messages.value.length
    messages.value.push({
      role: 'assistant',
      content: '',
      sources: sources,
      time: Date.now()
    })
    streaming.value = true
    loading.value = false

    // 读取流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      fullContent += chunk
      // 使用索引更新，确保响应式触发
      messages.value[aiMessageIndex].content = fullContent
      scrollToBottom()
    }

  } catch (error) {
    console.error('发送失败:', error)
    messages.value.push({
      role: 'assistant',
      content: '抱歉，请求失败，请稍后重试。',
      time: Date.now()
    })
  } finally {
    loading.value = false
    streaming.value = false
    scrollToBottom()
  }
}

useHead({ title: '对话 - aissr' })
</script>

<style scoped>
/* 动画效果 */
.delay-100 {
  animation-delay: 0.1s;
}
.delay-200 {
  animation-delay: 0.2s;
}

/* 消息滑入动画 */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in {
  animation: slideIn 0.3s ease-out forwards;
}

/* 过渡动画 */
.message-enter-active,
.message-leave-active {
  transition: all 0.3s ease;
}

.message-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.message-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* 淡入缩放 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.4s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* 淡入 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d6d3d1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a29e;
}
</style>
