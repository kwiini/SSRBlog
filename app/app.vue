<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// 初始化暗色模式(读取 localStorage / 跟随系统)
useColorMode();
</script>

<style>
/* 自然风格全局样式 */
html {
  scroll-behavior: smooth;
}

/* 选择文本的颜色 */
::selection {
  background-color: #d6d3d1;
  color: #1c1917;
}
</style>
