<template>
  <div class="h-[calc(100vh-220px)] flex flex-col">
    <!-- 简洁头部 -->
    <header class="flex items-center justify-between pb-4 border-b border-stone-200/60">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="useRAG ? 'bg-emerald-700' : 'bg-stone-800'">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="useRAG" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-medium text-stone-800">{{ useRAG ? '知识库对话' : '对话' }}</h1>
          <p class="text-xs text-stone-500">{{ useRAG ? '基于博客内容的智能问答' : (configStatus?.model || '准备就绪') }}</p>
        </div>
      </div>
      
      <!-- RAG 开关 -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-stone-500">启用知识库</span>
        <button
          @click="useRAG = !useRAG"
          :class="useRAG ? 'bg-emerald-600' : 'bg-stone-300'"
          class="relative w-11 h-6 rounded-full transition-colors"
        >
          <span
            :class="useRAG ? 'translate-x-1' : '-translate-x-4.5'"
            class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
          />
        </button>
      </div>
    </header>

    <!-- 消息列表 -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto py-4 space-y-4">
      <!-- 欢迎消息 -->
      <div v-if="messages.length === 0" class="text-center py-12">
        <div class="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
        </div>
        <h3 class="text-stone-700 font-medium mb-1">{{ useRAG ? '开始知识库对话' : '开始对话' }}</h3>
        <p class="text-sm text-stone-500">{{ useRAG ? '基于博客知识库回答你的问题' : '与 AI 助手交流' }}</p>
      </div>

      <!-- 消息项 -->
      <div
        v-for="(msg, index) in messages"
        :key="index"
        v-show="!(msg.role === 'assistant' && !msg.content && loading)"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div class="flex max-w-[85%] gap-3" :class="msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'">
          <!-- 头像 -->
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            :class="msg.role === 'user' ? 'bg-stone-700' : 'bg-emerald-600'"
          >
            <span class="text-xs font-medium text-white">
              {{ msg.role === 'user' ? '我' : 'AI' }}
            </span>
          </div>

          <!-- 消息内容 -->
          <div class="flex flex-col">
            <!-- 引用来源 (仅 AI 消息) -->
            <div v-if="msg.role === 'assistant' && msg.sources && msg.sources.length > 0" class="mb-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-t-xl">
              <p class="text-xs text-emerald-600 mb-1">参考来源：</p>
              <div class="flex flex-wrap gap-1">
                <NuxtLink
                  v-for="source in msg.sources"
                  :key="source.path"
                  :to="source.path"
                  class="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-emerald-700 rounded text-xs hover:bg-emerald-100 transition-colors"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  {{ source.title }}
                </NuxtLink>
              </div>
            </div>

            <div
              class="px-4 py-2.5 text-sm leading-relaxed"
              :class="[
                msg.role === 'user' 
                  ? 'bg-stone-800 text-white rounded-2xl rounded-br-md' 
                  : 'bg-white border border-stone-200 text-stone-700 rounded-2xl rounded-bl-md shadow-sm',
                msg.sources && msg.sources.length > 0 ? 'rounded-t-none' : ''
              ]"
            >
              <p class="whitespace-pre-wrap">{{ msg.content }}</p>
            </div>
            
            <!-- 时间戳 -->
            <span class="text-[10px] mt-1.5 text-stone-400" :class="msg.role === 'user' ? 'text-right' : 'text-left'">
              {{ formatTime(msg.time) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading && !streaming" class="flex justify-start">
        <div class="bg-white border border-stone-200 rounded-2xl px-4 py-3">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 bg-stone-400 rounded-full animate-bounce"/>
            <div class="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-100"/>
            <div class="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-200"/>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="border-t border-stone-200/60 pt-4">
      <div class="relative">
        <textarea
          v-model="inputMessage"
          rows="2"
          :placeholder="useRAG ? '输入问题，基于博客知识库回答...' : '输入消息...'"
          class="w-full px-4 py-3 pr-14 bg-white border border-stone-200 rounded-xl text-sm resize-none focus:border-stone-400 focus:outline-none transition-colors"
          @keydown="handleKeydown"
          @input="autoResize"
          ref="inputRef"
          :disabled="loading"
        />
        <button
          @click="sendMessage"
          :disabled="!inputMessage.trim() || loading"
          class="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      </div>
      <p class="text-xs text-stone-400 mt-2 text-center">
        {{ useRAG ? '已启用知识库检索' : '普通对话模式' }} · Enter 发送 · Shift+Enter 换行
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

// 自动调整输入框高度
const autoResize = () => {
  const textarea = inputRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
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
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
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

// 提取引用来源（简单实现）
const extractSources = (content) => {
  // 这里可以根据实际内容格式提取来源
  // 简单返回空数组，实际项目中可以解析内容中的引用标记
  return []
}

useHead({ title: '对话 - aissr' })
</script>

<style scoped>
.delay-100 {
  animation-delay: 0.1s;
}
.delay-200 {
  animation-delay: 0.2s;
}
</style>
