import { promises as fs } from 'fs'
import { join } from 'path'

interface PostData {
  title: string
  slug: string
  content: string
  description?: string
  date?: string
  tags?: string[]
  publish?: boolean
}

const CONTENT_DIR = join(process.cwd(), 'content', 'articles')

/**
 * 确保内容目录存在
 */
async function ensureContentDir() {
  try {
    await fs.access(CONTENT_DIR)
  } catch {
    await fs.mkdir(CONTENT_DIR, { recursive: true })
  }
}

/**
 * 生成文章文件内容
 */
function generateMarkdown(data: PostData): string {
  const frontmatter = {
    title: data.title,
    description: data.description || '',
    date: data.date || new Date().toISOString().split('T')[0],
    tags: data.tags || []
  }

  const frontmatterYaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`
      }
      return `${key}: ${value}`
    })
    .join('\n')

  return `---\n${frontmatterYaml}\n---\n\n${data.content}`
}

/**
 * 保存文章
 */
async function savePost(data: PostData, isUpdate: boolean = false): Promise<{ path: string; slug: string }> {
  await ensureContentDir()

  // 验证 slug
  const slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  
  if (!slug) {
    throw new Error('无效的文章路径')
  }

  const filePath = join(CONTENT_DIR, `${slug}.md`)

  // 如果是更新，检查文件是否存在
  if (isUpdate) {
    try {
      await fs.access(filePath)
    } catch {
      throw new Error('文章不存在')
    }
  } else {
    // 如果是新建，检查是否已存在
    try {
      await fs.access(filePath)
      throw new Error('文章路径已存在')
    } catch (err: any) {
      if (err.message === '文章路径已存在') throw err
    }
  }

  // 生成 Markdown 内容
  const markdown = generateMarkdown(data)

  // 写入文件
  await fs.writeFile(filePath, markdown, 'utf-8')

  return {
    path: `/articles/${slug}`,
    slug
  }
}

/**
 * 删除文章
 */
async function deletePost(path: string): Promise<void> {
  // 从路径提取 slug
  const slug = path.replace('/articles/', '').replace(/^\//, '').trim()
  
  if (!slug) {
    throw new Error('无效的文章路径')
  }

  const filePath = join(CONTENT_DIR, `${slug}.md`)

  try {
    await fs.access(filePath)
    await fs.unlink(filePath)
  } catch {
    throw new Error('文章不存在')
  }
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  // POST - 创建新文章
  if (method === 'POST') {
    try {
      const body = await readBody(event) as PostData
      
      if (!body.title?.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: '文章标题不能为空'
        })
      }

      if (!body.content?.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: '文章内容不能为空'
        })
      }

      const result = await savePost(body, false)

      return {
        success: true,
        message: '文章创建成功',
        data: result
      }
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || '创建文章失败'
      })
    }
  }

  // PUT - 更新文章
  if (method === 'PUT') {
    try {
      const body = await readBody(event) as PostData
      
      if (!body.title?.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: '文章标题不能为空'
        })
      }

      if (!body.content?.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: '文章内容不能为空'
        })
      }

      const result = await savePost(body, true)

      return {
        success: true,
        message: '文章更新成功',
        data: result
      }
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || '更新文章失败'
      })
    }
  }

  // DELETE - 删除文章
  if (method === 'DELETE') {
    try {
      const body = await readBody(event) as { path: string }
      
      if (!body.path) {
        throw createError({
          statusCode: 400,
          statusMessage: '缺少文章路径'
        })
      }

      await deletePost(body.path)

      return {
        success: true,
        message: '文章删除成功'
      }
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || '删除文章失败'
      })
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
