# AISSR Blog

一个基于 Nuxt 3 构建的现代化个人博客系统，集成了 AI 智能对话和 RAG（检索增强生成）知识库功能。

## ✨ 特性

- 📝 **Markdown 文章管理** - 使用 `@nuxt/content` 模块，支持 Markdown 格式编写文章
- 🤖 **AI 智能对话** - 集成大语言模型，支持流式对话响应
- 📚 **RAG 知识库** - 基于博客内容的智能问答系统，自动检索相关文章片段
- 🔍 **文章搜索** - 支持全文搜索和相关文章推荐
- 🎨 **精致 UI 设计** - 使用 Tailwind CSS 打造的自然风格界面
- ⚡ **高性能** - 基于 Nuxt 3 的 SSR/SSG 渲染，快速加载

## 🛠️ 技术栈

- **框架**: [Nuxt 3](https://nuxt.com/) - Vue 3 全栈框架
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/) - 原子化 CSS 框架
- **内容管理**: [@nuxt/content](https://content.nuxt.com/) - 基于文件的 CMS
- **AI 集成**: 支持 OpenAI 兼容 API
- **向量存储**: 本地 JSON 文件存储文章向量
- **数据库**: Better SQLite3

## 📁 项目结构

```
aissrblog/
├── app/                    # 前端应用代码
│   ├── assets/css/         # 全局样式
│   ├── layouts/            # 页面布局
│   │   ├── default.vue     # 默认布局
│   │   └── admin.vue       # 后台布局
│   ├── pages/              # 页面路由
│   │   ├── index.vue       # 首页（文章列表）
│   │   ├── articles/       # 文章详情页
│   │   ├── chat.vue        # AI 对话页面
│   │   ├── blog-vector.vue # 知识库管理
│   │   └── admin/          # 后台管理
│   └── app.vue             # 应用入口
├── content/                # Markdown 文章目录
│   └── articles/           # 文章文件
├── server/                 # 服务端代码
│   ├── api/                # API 接口
│   │   ├── posts.ts        # 文章列表接口
│   │   ├── aichat.ts       # AI 对话接口
│   │   ├── aichat-stream.ts # 流式对话接口
│   │   ├── rag-chat.ts     # RAG 知识库对话
│   │   ├── blog-vectorize.ts # 文章向量化
│   │   ├── blog-search.ts  # 文章搜索
│   │   ├── embedding.ts    # 文本嵌入接口
│   │   └── related-posts.ts # 相关文章推荐
│   └── utils/              # 服务端工具函数
│       ├── llm.ts          # LLM 调用封装
│       ├── embedding.ts    # 嵌入模型封装
│       ├── rag.ts          # RAG 核心逻辑
│       ├── chunker.ts      # 文本分块处理
│       └── embedding-cache.ts # 向量缓存
├── data/                   # 数据存储
│   └── blog-vectors.json   # 文章向量数据库
├── public/                 # 静态资源
├── nuxt.config.ts          # Nuxt 配置
└── package.json            # 项目依赖
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并填写你的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# AI LLM 配置
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-turbo
EMBEDDING_MODEL=text-embedding-v3
```

> 💡 默认使用阿里云百炼平台，支持任何 OpenAI 兼容的 API

### 开发模式

```bash
npm run dev
```

访问 <http://localhost:3000>

### 构建生产版本

```bash
npm run build
```

### 生成静态站点

```bash
npm run generate
```

## 📝 写作指南

### 创建文章

在 `content/articles/` 目录下创建 `.md` 文件：

```markdown
---
title: 文章标题
description: 文章描述
date: 2024-01-15
tags: [标签1, 标签2]
---

# 正文内容

支持标准 Markdown 语法...
```

### 更新知识库

新增或修改文章后，需要更新向量数据库：

1. 访问 `/blog-vector` 页面
2. 点击"重新向量化"按钮
3. 等待处理完成

## 🔧 API 接口

| 接口                    | 方法   | 说明         |
| --------------------- | ---- | ---------- |
| `/api/posts`          | GET  | 获取文章列表     |
| `/api/aichat`         | POST | AI 对话（非流式） |
| `/api/aichat-stream`  | POST | AI 对话（流式）  |
| `/api/rag-chat`       | POST | RAG 知识库对话  |
| `/api/blog-vectorize` | POST | 文章向量化      |
| `/api/blog-search`    | GET  | 文章搜索       |
| `/api/related-posts`  | GET  | 相关文章推荐     |

## 🔮 未来计划

- [ ] 文章评论系统
- [ ] 文章分类/标签云
- [ ] 深色模式支持
- [ ] RSS 订阅
- [ ] 文章阅读量统计
- [ ] 多语言支持

