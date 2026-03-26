import { splitMarkdownToChunks, extractTextFromMarkdown } from "../utils/chunker"
import { getEmbeddings } from "../utils/embedding"
import { promises as fs } from 'fs'
import { join } from 'path'

interface VectorizedChunk {
  id: string
  content: string
  embedding: number[]
  source: string
  metadata: {
    title: string
    path: string
    index: number
    total: number
  }
}

interface VectorStore {
  version: string
  lastUpdated: string
  chunks: VectorizedChunk[]
}

const VECTOR_STORE_PATH = join(process.cwd(), 'data', 'blog-vectors.json')

/**
 * 确保数据目录存在
 */
async function ensureDataDir() {
  const dataDir = join(process.cwd(), 'data')
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

/**
 * 读取所有博客文章
 */
async function getAllBlogPosts() {
  // 从 content 目录直接读取 Markdown 文件
  const contentDir = join(process.cwd(), 'content')
  const posts: any[] = []
  
  try {
    await fs.access(contentDir)
    await readMarkdownFiles(contentDir, posts)
  } catch {
    console.warn('Content directory not found')
  }
  
  return posts
}

/**
 * 递归读取 Markdown 文件
 */
async function readMarkdownFiles(dir: string, posts: any[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    
    if (entry.isDirectory()) {
      await readMarkdownFiles(fullPath, posts)
    } else if (entry.name.endsWith('.md')) {
      const content = await fs.readFile(fullPath, 'utf-8')
      const relativePath = fullPath.replace(process.cwd(), '').replace(/\\/g, '/').replace('/content', '').replace('.md', '')
      
      // 解析 frontmatter
      const { frontmatter, body } = parseMarkdown(content)
      
      posts.push({
        path: relativePath,
        title: frontmatter.title || entry.name.replace('.md', ''),
        description: frontmatter.description || '',
        meta: { date: frontmatter.date },
        body: { value: body }
      })
    }
  }
}

/**
 * 简单解析 Markdown frontmatter
 */
function parseMarkdown(content: string) {
  const frontmatter: Record<string, string> = {}
  let body = content
  
  // 匹配 frontmatter
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (match) {
    const frontmatterText = match[1]
    body = match[2] ?? ''
    
    // 解析 key: value
    frontmatterText?.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim()
        const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '')
        frontmatter[key] = value
      }
    })
  }
  
  return { frontmatter, body }
}

/**
 * 向量化所有博客文章
 */
async function vectorizeAllBlogs(): Promise<VectorizedChunk[]> {
  const posts = await getAllBlogPosts()

  if (!posts.length) {
    throw new Error('没有找到博客文章')
  }

  const allChunks: VectorizedChunk[] = []

  for (const post of posts) {
    console.log(`Processing: ${post.title}`)

    // 获取 Markdown 内容
    const markdown = post.body?.value
      ? JSON.stringify(post.body.value)
      : ''

    if (!markdown) {
      console.warn(`No content for: ${post.title}`)
      continue
    }

    // 切分为 chunks
    const chunks = splitMarkdownToChunks(
      markdown,
      post.path,
      {
        title: post.title,
        path: post.path
      }
    )

    if (chunks.length === 0) {
      continue
    }

    // 批量获取 embeddings
    const texts = chunks.map(c => c.content)
    const embeddings = await getEmbeddings(texts)

    // 组合 chunk 和 embedding
    for (let i = 0; i < chunks.length; i++) {
      allChunks.push({
        id: chunks[i]!.id,
        content: chunks[i]!.content,
        source: chunks[i]!.source,
        metadata: chunks[i]!.metadata,
        embedding: embeddings[i]!
      })
    }

    console.log(`  ✓ ${chunks.length} chunks`)
  }

  return allChunks
}

/**
 * 保存向量到本地文件
 */
async function saveVectors(chunks: VectorizedChunk[]) {
  await ensureDataDir()

  const store: VectorStore = {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    chunks
  }

  await fs.writeFile(
    VECTOR_STORE_PATH,
    JSON.stringify(store, null, 2),
    'utf-8'
  )

  return store
}

/**
 * 加载本地向量
 */
async function loadVectors(): Promise<VectorStore | null> {
  try {
    const data = await fs.readFile(VECTOR_STORE_PATH, 'utf-8')
    return JSON.parse(data) as VectorStore
  } catch {
    return null
  }
}

/**
 * 获取向量统计信息
 */
async function getVectorStats() {
  const store = await loadVectors()

  if (!store) {
    return {
      exists: false,
      chunkCount: 0,
      lastUpdated: null
    }
  }

  // 按文章统计
  const articleStats = new Map<string, number>()
  for (const chunk of store.chunks) {
    const count = articleStats.get(chunk.source) || 0
    articleStats.set(chunk.source, count + 1)
  }

  return {
    exists: true,
    chunkCount: store.chunks.length,
    articleCount: articleStats.size,
    lastUpdated: store.lastUpdated,
    articles: Array.from(articleStats.entries()).map(([path, count]) => ({
      path,
      chunks: count
    }))
  }
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  // GET - 获取统计信息
  if (method === 'GET') {
    try {
      const stats = await getVectorStats()
      return {
        success: true,
        ...stats
      }
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || '获取统计失败'
      })
    }
  }

  // POST - 执行向量化
  if (method === 'POST') {
    try {
      const body = await readBody(event)
      const { force = false } = body

      // 检查是否已存在
      if (!force) {
        const existing = await loadVectors()
        if (existing) {
          return {
            success: true,
            message: '向量已存在，使用 force: true 重新生成',
            stats: await getVectorStats()
          }
        }
      }

      console.log('Starting blog vectorization...')
      const startTime = Date.now()

      // 向量化所有博客
    const chunks = await vectorizeAllBlogs()

      // 保存到本地
      const store = await saveVectors(chunks)

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`Vectorization completed in ${duration}s`)

      return {
        success: true,
        message: `成功向量化 ${chunks.length} 个 chunks`,
        stats: {
          chunkCount: chunks.length,
          articleCount: new Set(chunks.map(c => c.source)).size,
          duration: `${duration}s`,
          lastUpdated: store.lastUpdated
        }
      }
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || '向量化失败'
      })
    }
  }

  // DELETE - 清除向量
  if (method === 'DELETE') {
    try {
      await fs.unlink(VECTOR_STORE_PATH).catch(() => {})
      return {
        success: true,
        message: '向量数据已清除'
      }
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || '清除失败'
      })
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
