<template>
  <div class="h-[calc(100vh-220px)] flex flex-col">
    <!-- 简洁头部 -->
    <header class="flex items-center justify-between pb-4 border-b border-stone-200/60">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-stone-800 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-base font-medium text-stone-800">对话</h1>
          <p class="text-xs text-stone-500">{{ configStatus?.model || '准备就绪' }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full" :class="configStatus?.hasKey ? 'bg-emerald-500' : 'bg-amber-500'"></span>
        <span class="text-xs text-stone-500">{{ configStatus?.hasKey ? '在线' : '未配置' }}</span>
      </div>
    </header>

    <!-- 消息列表 -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto py-6 space-y-5">
      <!-- 欢迎消息 -->
      <div v-if="messages.length === 0" class="text-center py-16">
        <div class="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
        </div>
        <p class="text-stone-500 text-sm">开始一段对话</p>
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
            class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            :class="msg.role === 'user' ? 'bg-stone-700' : 'bg-stone-200'"
          >
            <span class="text-xs font-medium" :class="msg.role === 'user' ? 'text-white' : 'text-stone-600'">
              {{ msg.role === 'user' ? '我' : 'AI' }}
            </span>
          </div>

          <!-- 消息内容 -->
          <div class="flex flex-col">
            <div
              class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
              :class="msg.role === 'user' 
                ? 'bg-stone-800 text-white rounded-br-md' 
                : 'bg-white border border-stone-200 text-stone-700 rounded-bl-md shadow-sm'"
            >
              <p class="whitespace-pre-wrap">{{ msg.content }}</p>
            </div>
            <span class="text-[10px] mt-1.5 text-stone-400" :class="msg.role === 'user' ? 'text-right' : 'text-left'">
              {{ formatTime(msg.timestamp) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Loading 状态 -->
      <div v-if="loading && !streaming" class="flex justify-start">
        <div class="flex gap-3">
          <div class="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center mt-0.5">
            <span class="text-xs font-medium text-stone-600">AI</span>
          </div>
          <div class="px-4 py-2.5 bg-white border border-stone-200 rounded-2xl rounded-bl-md shadow-sm">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style="animation-delay: 0s"></span>
              <span class="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style="animation-delay: 0.15s"></span>
              <span class="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style="animation-delay: 0.3s"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="pt-4 border-t border-stone-200/60">
      <div class="relative">
        <textarea
          v-model="inputMessage"
          rows="1"
          class="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 pr-12 resize-none outline-none text-sm text-stone-700 placeholder-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-100 transition-all"
          placeholder="输入消息..."
          :disabled="loading"
          @keydown="handleKeydown"
          @input="autoResize"
          ref="inputRef"
        ></textarea>
        <button
          @click="sendMessage"
          :disabled="!inputMessage.trim() || loading"
          class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-stone-700 disabled:text-stone-300 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      </div>
      <p class="text-center text-[10px] text-stone-400 mt-2">Enter 发送 · Shift+Enter 换行</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="fixed top-20 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
      {{ error }}
      <button @click="error = ''" class="ml-3 text-stone-400 hover:text-white">✕</button>
    </div>
  </div>
</template>

<script setup>
const messages = ref([])
const inputMessage = ref('')
const loading = ref(false)
const streaming = ref(false)
const error = ref('')
const messagesContainer = ref(null)
const inputRef = ref(null)

// 获取配置状态
const { data: configStatus } = await useFetch('/api/ai-config')

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
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
    if (e.shiftKey) return
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

// 发送消息（流式）
const sendMessage = async () => {
  const message = inputMessage.value.trim()
  if (!message || loading.value) return

  messages.value.push({
    role: 'user',
    content: message,
    timestamp: Date.now()
  })

  const aiMessageIndex = messages.value.push({
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  }) - 1

  inputMessage.value = ''
  loading.value = true
  streaming.value = false
  error.value = ''
  scrollToBottom()

  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }

  try {
    const historyMessages = messages.value
      .slice(0, -1)
      .map(msg => ({ role: msg.role, content: msg.content }))

    const response = await fetch('/api/aichat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: historyMessages })
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法获取响应流')

    streaming.value = true
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.content) {
              messages.value[aiMessageIndex].content += data.content
              scrollToBottom()
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    error.value = err.message || '发送失败'
    messages.value.splice(aiMessageIndex, 1)
  } finally {
    loading.value = false
    streaming.value = false
    scrollToBottom()
  }
}

useHead({ title: '对话 - aissr' })
</script>

<style scoped>
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: #a8a29e; }

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.animate-bounce { animation: bounce 0.5s infinite; }
</style>
