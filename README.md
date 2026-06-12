# Curata

> 央企办公室小组内部使用的 AI 智能文献综述工具。从已有文章库中选取或上传新文献，一键生成结构化、可汇报的文献综述。

## ✨ 核心功能

- 📚 **文献综述一键生成** - 上传文献或从文章库中选择，AI 自动提炼研究背景、核心内容、创新点、研究趋势
- 🎯 **多源文献组合** - 灵活组合多篇文献，AI 综合分析各篇内容、归纳异同
- 📝 **五段式结构化输出** - 「研究背景 / 核心内容梳理 / 创新点对比 / 研究趋势 / 个人思考」模板，可直接套用汇报
- ✍️ **在线可编辑** - 生成结果支持在线微调、补充个人思考
- 📤 **导出 Markdown** - 一键导出 `.md` 文件，便于二次排版与归档
- 🔍 **辅助知识库** - 基于文章库的智能问答、语义搜索与相关文章推荐
- 🎨 **自然风格 UI** - Tailwind CSS 4 打造的石系色调界面，长时间阅读不疲劳

## 🛠️ 技术栈

- **框架**: [Nuxt 4](https://nuxt.com/) - Vue 3 全栈框架，支持 SSR/SSG
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/) - 原子化 CSS 框架
- **内容管理**: [@nuxt/content](https://content.nuxt.com/) - 基于文件的 CMS，承载文献库
- **AI 集成**: 支持 OpenAI 兼容 API（默认阿里云百炼 / Qwen）
- **向量存储**: 本地 JSON 文件存储文章向量（轻量、易部署）
- **数据库**: Better SQLite3

## 📁 项目结构

```
curata/
├── app/                      # 前端应用代码
│   ├── assets/css/           # 全局样式
│   ├── composables/          # 组合式函数
│   │   └── useAdminAuth.ts   # 管理员认证
│   ├── layouts/              # 页面布局
│   │   ├── default.vue       # 默认布局
│   │   └── admin.vue         # 后台布局
│   ├── pages/                # 页面路由
│   │   ├── index.vue         # 首页(文献库列表)
│   │   ├── articles/         # 文章详情页
│   │   ├── literature-review.vue # 📚 文献综述生成(核心)
│   │   ├── chat.vue          # 知识库问答
│   │   ├── blog-vector.vue   # 知识库管理
│   │   └── admin/            # 后台管理
│   └── app.vue               # 应用入口
├── content/                  # Markdown 文献库
│   └── articles/             # 文献文件
├── server/                   # 服务端代码
│   ├── api/                  # API 接口
│   │   ├── literature-review/ # 📚 文献综述生成接口(核心)
│   │   ├── posts.ts          # 文献列表接口
│   │   ├── aichat.ts         # AI 对话接口
│   │   ├── aichat-stream.ts  # 流式对话接口
│   │   ├── rag-chat.ts       # RAG 知识库对话
│   │   ├── blog-vectorize.ts # 文献向量化
│   │   ├── blog-search.ts    # 文献搜索
│   │   ├── embedding.ts      # 文本嵌入接口
│   │   └── related-posts.ts  # 相关文献推荐
│   └── utils/                # 服务端工具函数
│       ├── llm.ts            # LLM 调用封装
│       ├── rag.ts            # RAG 核心逻辑
│       ├── chunker.ts        # 文本分块处理
│       └── embedding-cache.ts # 向量缓存
├── data/                     # 数据存储
│   └── blog-vectors.json     # 文献向量数据库
├── public/                   # 静态资源
├── nuxt.config.ts            # Nuxt 配置
└── package.json              # 项目依赖
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

## 📚 使用指南

### 1. 添加文献到文章库(可选)

将 Markdown 格式的文献放入 `content/articles/` 目录，作为可复用的内部文献库。后续生成综述时可直接从中选择，无需重复上传。

```markdown
---
title: 文献标题
description: 文献描述
date: 2024-01-15
tags: [标签1, 标签2]
---

# 正文内容
...
```

### 2. 生成文献综述

1. 访问 `/literature-review` 页面
2. 拖拽或选择 TXT / Markdown / PDF / Word 文件上传
3. 点击「生成文献综述」按钮
4. AI 输出五段式内容：研究背景 / 核心内容梳理 / 创新点对比 / 研究趋势
5. 在「个人思考与启发」一栏补充自己的理解

### 3. 导出与归档

点击「导出 Markdown」即可下载为 `.md` 文件，便于二次排版、插入汇报材料或留档。

### 4. 更新知识库(高级)

如需使用 RAG 知识库问答等辅助功能：

1. 访问 `/blog-vector` 页面
2. 点击「重新向量化」按钮
3. 等待处理完成

## 🔧 API 接口

| 接口                       | 方法   | 说明                  |
| ------------------------ | ---- | ------------------- |
| `/api/literature-review` | POST | 📚 文献综述生成(核心)       |
| `/api/posts`             | GET  | 获取文献列表              |
| `/api/aichat`            | POST | AI 对话(非流式)          |
| `/api/aichat-stream`     | POST | AI 对话(流式)           |
| `/api/rag-chat`          | POST | RAG 知识库对话           |
| `/api/blog-vectorize`    | POST | 文献向量化               |
| `/api/blog-search`       | GET  | 文献搜索                |
| `/api/related-posts`     | GET  | 相关文献推荐              |

## 🔮 未来计划

- [ ] PDF / Word 真实文本解析（替代当前仅 TXT/MD 可用）
- [ ] Map-Reduce 多文献分批处理，支持更多文献一次性综合
- [ ] 服务端 SQLite 持久化 + 历史综述归档
- [ ] 真实用户体系 + 服务端权限校验
- [ ] 导出 Word (.docx) / PPT 模板
- [ ] GB/T 7714 参考文献格式自动生成
- [ ] 文献元数据（作者 / 期刊 / 年份）自动抽取
- [ ] 深色模式支持
