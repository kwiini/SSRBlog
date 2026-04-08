/**
 * 文本切分工具 - 将长文本切分为适合 embedding 的 chunks
 */

export interface Chunk {
  id: string; // chunk 的唯一标识符
  content: string; // chunk 内容
  source: string; // 来源标识
  metadata: {
    title: string;
    path: string;
    index: number; // chunk 在文本中的索引
    total: number; // 文本中的总 chunk 数量
  };
}

interface ChunkOptions {
  chunkSize?: number; // 每个 chunk 的最大字符数
  chunkOverlap?: number; // 相邻 chunk 的重叠字符数
  separators?: string[]; // 分隔符优先级列表
}

const DEFAULT_OPTIONS: ChunkOptions = {
  chunkSize: 500,
  chunkOverlap: 50,
  separators: ["\n## ", "\n### ", "\n\n", "\n", "。", "；", " "], // 优先级从高到低
};

/**
 * 将文本切分为 chunks
 * @param text 原始文本
 * @param source 来源标识
 * @param metadata 元数据
 * @param options 切分选项
 * @returns chunks 数组
 */
export function splitTextToChunks(
  text: string,
  source: string,
  metadata: { title: string; path: string },
  options: ChunkOptions = {},
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, chunkOverlap, separators } = opts;

  // 清理文本
  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!cleanText) return [];

  // 如果文本长度小于 chunkSize，直接返回
  if (cleanText.length <= chunkSize!) {
    return [
      {
        id: generateChunkId(source, 0),
        content: cleanText,
        source,
        metadata: { ...metadata, index: 0, total: 1 },
      },
    ];
  }

  const chunks: Chunk[] = [];
  let startIndex = 0; // 当前 chunk 的起始索引
  let chunkIndex = 0; // 当前 chunk 的索引

  while (startIndex < cleanText.length) {
    // 计算当前 chunk 的结束位置
    let endIndex = Math.min(startIndex + chunkSize!, cleanText.length);

    // 如果不是最后一段，尝试在分隔符处分割
    if (endIndex < cleanText.length) {
      const searchText = cleanText.slice(startIndex, endIndex + 100); // 多搜索一些字符
      const bestSplit = findBestSplitPoint(searchText, chunkSize!, separators!); // 查找最佳分割点
      endIndex = startIndex + bestSplit; // 更新结束位置为最佳分割点
    }

    // 提取 chunk 内容
    const chunkContent = cleanText.slice(startIndex, endIndex).trim();

    if (chunkContent) {
      chunks.push({
        id: generateChunkId(source, chunkIndex),
        content: chunkContent,
        source,
        metadata: { ...metadata, index: chunkIndex, total: 0 },
      });
      chunkIndex++;
    }

    // 移动起始位置（考虑重叠）
    startIndex = endIndex - chunkOverlap!; // 更新起始位置为结束位置减去重叠字符数
    if (startIndex >= endIndex) break; // 防止死循环
  }

  // 更新 total
  chunks.forEach((chunk) => {
    chunk.metadata.total = chunks.length;
  });

  return chunks;
}

/**
 * 查找最佳分割点
 * @param text 文本
 * @param targetLength 目标长度
 * @param separators 分隔符列表
 * @returns 最佳分割位置
 */
function findBestSplitPoint(
  text: string,
  targetLength: number,
  separators: string[],
): number {
  // 优先在目标长度之前找分隔符
  const searchArea = text.slice(0, Math.min(targetLength + 200, text.length));

  for (const separator of separators) {
    const index = searchArea.lastIndexOf(separator, targetLength);
    if (index > targetLength * 0.5) {
      // 至少保留 50% 的内容
      return index + separator.length;
    }
  }

  // 如果没找到合适的分隔符，在目标长度处截断
  return targetLength;
}

/**
 * 从 Markdown 内容中提取纯文本
 * @param markdown Markdown 内容
 * @returns 纯文本
 */
export function extractTextFromMarkdown(markdown: string): string {
  return (
    markdown
      // 移除代码块
      .replace(/```[\s\S]*?```/g, "[代码块]")
      // 移除行内代码
      .replace(/`([^`]+)`/g, "$1")
      // 移除图片
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      // 移除链接，保留文本
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // 移除 HTML 标签
      .replace(/<[^>]+>/g, "")
      // 移除标题标记
      .replace(/^#{1,6}\s+/gm, "")
      // 移除强调标记
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/(\*|_)(.+?)\1/g, "$2")
      // 移除引用标记
      .replace(/^>\s?/gm, "")
      // 移除列表标记
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      // 移除水平线
      .replace(/^-{3,}$/gm, "")
      // 合并多个空行
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * 生成 chunk ID
 * @param source 来源
 * @param index 索引
 * @returns ID
 */
function generateChunkId(source: string, index: number): string {
  const hash = source.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0; // 计算哈希值，确保非负数
  }, 0);
  return `chunk_${Math.abs(hash)}_${index}`;
}

/**
 * 智能切分 Markdown 文档
 * 优先按标题切分，然后按段落
 * @param markdown Markdown 内容
 * @param source 来源
 * @param metadata 元数据
 * @returns chunks 数组
 */
export function splitMarkdownToChunks(
  markdown: string,
  source: string,
  metadata: { title: string; path: string },
): Chunk[] {
  const chunks: Chunk[] = [];

  // 按二级标题分割文档
  const sections = markdown.split(/\n(?=##\s)/);

  let chunkIndex = 0;

  for (const section of sections) {
    if (!section.trim()) continue;

    // 提取纯文本
    const text = extractTextFromMarkdown(section);

    if (!text) continue;

    // 如果 section 太长，进一步切分
    if (text.length > 500) {
      const subChunks = splitTextToChunks(text, source, metadata, {
        chunkSize: 400,
        chunkOverlap: 50,
      });
      chunks.push(
        ...subChunks.map((chunk) => ({
          ...chunk,
          id: generateChunkId(source, chunkIndex++),
          metadata: { ...chunk.metadata, index: chunkIndex - 1 },
        })),
      );
    } else {
      chunks.push({
        id: generateChunkId(source, chunkIndex++),
        content: text,
        source,
        metadata: { ...metadata, index: chunkIndex - 1, total: 0 },
      });
    }
  }

  // 更新 total
  chunks.forEach((chunk) => {
    chunk.metadata.total = chunks.length;
  });

  return chunks;
}
