# Curata

Nuxt 4 全栈应用。文献综述生成 + RAG 知识库问答 + 文章管理，统一走 OpenAI 兼容的 LLM 接口。

## 架构概览

| 层 | 技术 | 用途 |
| --- | --- | --- |
| 前端 | Nuxt 4 + Vue 3 + Tailwind CSS 4 | 页面、组件、组合式函数 |
| 内容层 | @nuxt/content v3 + content.config.ts | `content/articles/` 下 Markdown 文档的查询与渲染 |
| 应用层 | Nuxt server routes (H3) | REST API 入口、JWT 鉴权、RBAC 中间件 |
| 检索层 | sqlite-vec + 自研 BM25 + LLM Cross-Encoder | 向量 KNN、关键词召回、LLM 重排 |
| 生成层 | OpenAI 兼容 Chat Completions | 综述生成、问答、改写 |
| 存储 | better-sqlite3 | 用户、综述归档、向量；数据文件 `data/curata.db` |

## 目录结构

```
curata/
├── app/                          # 前端
│   ├── app.vue                   # 入口
│   ├── layouts/default.vue       # 通用布局
│   ├── pages/
│   │   ├── index.vue             # 文章列表(@nuxt/content 查询)
│   │   ├── articles/[...slug].vue# 文章详情 + 相关文章
│   │   ├── literature-review.vue # 综述生成 / 归档
│   │   ├── chat.vue              # 知识库问答
│   │   ├── blog-vector.vue       # 向量化控制台
│   │   └── admin/
│   │       ├── index.vue         # 文章 + 草稿管理
│   │       └── write.vue         # 文章编辑器
│   ├── composables/
│   │   ├── useAdminAuth.ts       # 登录态 / RBAC 客户端
│   │   └── useColorMode.ts       # 暗色模式
│   ├── components/CurataLogo.vue
│   ├── plugins/api-auth.client.ts
│   └── lib/logger.ts
├── server/
│   ├── api/                      # 业务 API
│   │   ├── auth/                 # /api/auth/{login,logout,me}
│   │   ├── blog/                 # 博客 CRUD / 向量 / 搜索 / 关联
│   │   ├── chat/                 # 流式 AI 对话 / RAG
│   │   ├── literature-review/    # 综述生成 / 归档 / 审计
│   │   ├── posts/get.ts          # 单篇文章原始内容
│   │   └── ai-config.get.ts      # 客户端 AI 配置探测
│   ├── core/                     # 基础设施
│   │   ├── auth.ts               # requireAuth / requirePermission
│   │   ├── rbac.ts               # 角色与权限点
│   │   ├── user-store.ts         # PBKDF2 密码哈希 + JSON 用户表
│   │   ├── db.ts                 # SQLite 连接 / 建表 / 审计日志
│   │   ├── prompts.ts            # 集中托管的 prompt 模板
│   │   └── llm/                  # client / stream-client / cache / rate-limiter / tokens
│   ├── middleware/auth.ts        # 路径前缀 → 权限点映射
│   ├── plugins/bootstrap.ts      # 首次启动引导 admin
│   ├── services/
│   │   ├── rag.service.ts        # 检索 + 增强 + 上下文压缩 + RAG
│   │   └── review.service.ts     # Map-Reduce 综述生成
│   ├── retrieval/                # 检索子模块
│   │   ├── hybrid.ts             # 向量 + BM25 混合召回
│   │   ├── vector.ts             # embedding 缓存 + 余弦
│   │   ├── vector-db.ts          # sqlite-vec 封装
│   │   ├── bm25.ts               # 关键词召回
│   │   ├── query-expansion.ts    # 同义词 / step-back / HyDE
│   │   ├── reranker.ts           # LLM Cross-Encoder / MMR / RRF
│   │   ├── chunker.ts            # Markdown / 纯文本分块
│   │   ├── frontmatter.ts        # 极简 frontmatter 解析
│   │   ├── post-path.ts          # 文章路径安全解析
│   │   └── migrate-vectors.ts    # 老 JSON → SQLite 一次性迁移
│   ├── processors/               # 文本后处理
│   │   ├── context-compressor.ts # Jaccard 去重 + 关键词密度排序
│   │   ├── history-compressor.ts # 对话历史压缩
│   │   └── text-extractor.ts     # 论文关键章节抽取
│   ├── lib/logger.ts             # consola 统一入口
│   └── types/env.d.ts
├── tests/                        # vitest 单元测试
├── content/
│   └── articles/                 # Markdown 文献库(@nuxt/content 源)
├── data/                         # 运行时数据
│   ├── curata.db                 # SQLite(用户 / 综述 / 向量)
│   └── users.json                # 用户表
├── content.config.ts             # @nuxt/content v3 collection 定义
├── nuxt.config.ts                # Nuxt 配置 + runtimeConfig
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## 角色与权限

`server/core/rbac.ts` 中定义 4 种角色，对应 13 个权限点：

| 角色 | 范围 |
| --- | --- |
| `admin` | 全部权限(含系统配置) |
| `editor` | 博客 CRUD、向量、综述、评论、RAG |
| `reviewer` | 综述生成、评论、阅读、RAG |
| `viewer` | 只读 + RAG |

`server/middleware/auth.ts` 将 URL 前缀 + HTTP 方法映射到具体权限点。

## API

| 路径 | 方法 | 权限 | 用途 |
| --- | --- | --- | --- |
| `/api/auth/login` | POST | — | 登录,下发 JWT cookie |
| `/api/auth/logout` | POST | — | 清除 cookie |
| `/api/auth/me` | GET | — | 当前会话 |
| `/api/ai-config` | GET | — | 客户端 AI 配置探测(模型名脱敏) |
| `/api/blog/posts` | POST / PUT / PATCH / DELETE | `blog:*` | 文章 / 草稿 CRUD |
| `/api/blog/posts?listDrafts=1` | GET | `blog:read` | 列出草稿 |
| `/api/blog/vectorize` | GET / POST / DELETE | `vectorize:*` | 统计 / 重建 / 清空 |
| `/api/blog/search` | GET | `blog:read` | 关键词 + 向量混合搜索 |
| `/api/blog/related` | GET | `blog:read` | 相关文章推荐 |
| `/api/chat/aichat-stream` | GET | `rag:query` | 流式对话 |
| `/api/chat/rag-chat` | POST | `rag:query` | RAG 问答 |
| `/api/literature-review` | POST | `review:generate` | 综述生成 |
| `/api/literature-review/save` | POST | `review:generate` | 持久化综述 |
| `/api/literature-review/list` | GET | `review:read` | 当前用户归档列表 |
| `/api/literature-review/[id]` | GET / DELETE | `review:read` | 单条详情 / 删除 |
| `/api/literature-review/audit` | GET | `review:read` | 审计日志 |
| `/api/posts/get` | GET | `blog:read` | 读取单篇原始 Markdown |

## 核心数据流

### 综述生成

```
papers[]
  → server/services/review.service.ts
  → processors/text-extractor.ts(章节抽取 + 预算控制)
  → LLM 单篇摘要(Map 阶段)
  → LLM 批次合并(Reduce 阶段,BATCH_SIZE=6)
  → 持久化到 SQLite reviews / review_papers
```

### RAG 问答

```
question
  → retrieval/query-expansion.ts(同义词 / step-back / HyDE)
  → retrieval/hybrid.ts(向量 KNN + BM25,去重到文章级)
  → retrieval/reranker.ts(LLM Cross-Encoder 重排,可选 MMR)
  → processors/context-compressor.ts(600 字预算,关键词密度排序)
  → core/prompts.ts 拼装 prompt
  → LLM 流式输出
```

### 向量化

```
content/articles/*.md
  → retrieval/chunker.ts(按 ## 切分,800/150)
  → core/llm/client.ts 调 embedding(带 LRU + TTL + 请求合并)
  → retrieval/vector-db.ts 写入 sqlite-vec vec0 表
  → 启动时自动从老 data/blog-vectors.json 迁移并备份为 .bak
```

## 启动

### 环境要求

- Node.js 18+
- pnpm 或 npm

### 配置

```bash
cp .env.example .env
```

`.env` 变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `LLM_API_KEY` | 是 | OpenAI 兼容 API Key |
| `LLM_BASE_URL` | 否 | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `LLM_MODEL` | 否 | 对话模型,默认 `qwen-max` |
| `EMBEDDING_MODEL` | 否 | Embedding 模型,默认 `text-embedding-v3` |
| `ADMIN_PASSWORD` | 是 | 首次启动引导 admin 账号的密码 |
| `JWT_SECRET` | 否 | JWT 签名密钥,留空则由 `ADMIN_PASSWORD` 派生 |

### 命令

```bash
npm install        # 安装依赖并 nuxt prepare
npm run dev        # 开发模式,默认 http://localhost:3000
npm run build      # 生产构建
npm run preview    # 预览生产构建
npm run generate   # 预渲染
npm test           # 单元测试(vitest)
```

## 数据存储

| 文件 | 来源 | 说明 |
| --- | --- | --- |
| `data/curata.db` | `server/core/db.ts` | 用户 / 综述 / papers / 审计日志 / vec0 向量 |
| `data/users.json` | `server/core/user-store.ts` | 用户表 + PBKDF2 哈希参数 |
| `data/blog-vectors.json.bak` | `retrieval/migrate-vectors.ts` | 老 JSON 格式备份(若有) |

`.gitignore` 已排除 `data/*.db`、`data/*.bak`、`data/users.json`、`content/articles/*.md`。

## 测试

```bash
npm test                # 一次性跑全量
npm run test:watch      # 监听模式
```

覆盖模块：`retrieval/bm25`、`retrieval/vector-db`、`retrieval/query-expansion`、`processors/context-compressor`。

## 内容扩展

向 `content/articles/` 放入 Markdown 文件即可被 `@nuxt/content` 自动收录:

```markdown
---
title: 文献标题
description: 简述
date: 2024-01-15
tags: [标签1, 标签2]
---

# 正文
```

- 集合 `content` 在 `content.config.ts` 中声明,前缀 `/articles`
- 前端通过 `queryCollection("content").all()` / `.path("/articles/<slug>").first()` 调用
- 访问 `/blog-vector` 点击「重新向量化」即可重建向量索引
