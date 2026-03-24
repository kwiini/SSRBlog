<template>
  <div class="bg-white rounded-lg shadow-sm p-6">
    <h1 class="text-3xl font-bold text-gray-900 mb-4">SSR 渲染验证</h1>
    
    <div class="space-y-4">
      <div class="p-4 bg-gray-50 rounded-lg">
        <h2 class="text-xl font-semibold mb-2">服务端渲染时间</h2>
        <p class="text-gray-700">{{ serverTime }}</p>
        <p class="text-sm text-gray-500 mt-1">此时间应在服务端生成，刷新页面时应该变化</p>
      </div>
      
      <div class="p-4 bg-gray-50 rounded-lg">
        <h2 class="text-xl font-semibold mb-2">客户端渲染时间</h2>
        <p class="text-gray-700">{{ clientTime }}</p>
        <p class="text-sm text-gray-500 mt-1">此时间在客户端生成， hydration 后显示</p>
      </div>
      
      <div class="p-4 bg-gray-50 rounded-lg">
        <h2 class="text-xl font-semibold mb-2">渲染模式</h2>
        <p class="text-gray-700">{{ renderMode }}</p>
      </div>
    </div>
    
    <NuxtLink to="/" class="mt-8 inline-block text-blue-600 hover:text-blue-800">
      返回首页
    </NuxtLink>
  </div>
</template>

<script setup>
// SEO 优化
useHead({
  title: 'SSR 渲染验证 - AISSR Blog',
  meta: [
    { name: 'description', content: '验证 Nuxt.js SSR 服务端渲染是否正常工作' }
  ]
})

// 服务端时间（在服务端渲染时生成）
const serverTime = ref('')

// 客户端时间（在客户端 hydration 后生成）
const clientTime = ref('')

// 渲染模式
const renderMode = ref('')

// 在服务端获取时间
if (process.server) {
  serverTime.value = new Date().toLocaleString()
  renderMode.value = '服务端渲染 (SSR)'
}

// 在客户端获取时间
onMounted(() => {
  clientTime.value = new Date().toLocaleString()
  if (!serverTime.value) {
    renderMode.value = '客户端渲染 (CSR)'
  } else {
    renderMode.value = '服务端渲染 + 客户端 Hydration'
  }
})
</script>