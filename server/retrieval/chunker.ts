/**
 * 文本切分
 * - splitTextToChunks:通用切分器,按优先级分隔符在 chunkSize 附近找最佳切点
 * - splitMarkdownToChunks:先按 ## 章节切,长 section 再递归用 splitTextToChunks
 * - extractTextFromMarkdown:去 markdown 标记,得到纯文本
 *
 * chunk 默认 800 字 / 150 重叠,既保留上下文又避免 embedding 切断语义
 */

export interface Chunk {
  id: string;
  content: string;
  source: string;
  metadata: {
    title: string;
    path: string;
    index: number;
    total: number;
  };
}

interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

const DEFAULT_OPTIONS: ChunkOptions = {
  chunkSize: 800,
  chunkOverlap: 150,
  separators: [
    "\n## ",
    "\n### ",
    "\n#### ",
    "\n\n",
    "。",
    "？",
    "！",
    "；",
    "\n",
    " "
  ],
};

/**
 * 将文本切分为 chunks
 */
export function splitTextToChunks(
  text: string,
  source: string,
  metadata: { title: string; path: string },
  options: ChunkOptions = {},
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, chunkOverlap, separators } = opts;

  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!cleanText) return [];

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
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = Math.min(startIndex + chunkSize!, cleanText.length);

    if (endIndex < cleanText.length) {
      const searchText = cleanText.slice(startIndex, endIndex + 100);
      const bestSplit = findBestSplitPoint(searchText, chunkSize!, separators!);
      endIndex = startIndex + bestSplit;
    }

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

    startIndex = endIndex - chunkOverlap!;
    if (startIndex >= endIndex) break;
  }

  chunks.forEach((chunk) => {
    chunk.metadata.total = chunks.length;
  });

  return chunks;
}

function findBestSplitPoint(
  text: string,
  targetLength: number,
  separators: string[],
): number {
  const searchArea = text.slice(0, Math.min(targetLength + 200, text.length));

  for (const separator of separators) {
    const index = searchArea.lastIndexOf(separator, targetLength);
    if (index > targetLength * 0.5) {
      return index + separator.length;
    }
  }

  return targetLength;
}

/**
 * 从 Markdown 内容中提取纯文本
 */
export function extractTextFromMarkdown(markdown: string): string {
  return (
    markdown
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/(\*|_)(.+?)\1/g, "$2")
      .replace(/^>\s?/gm, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/^-{3,}$/gm, "")
      .replace(/\s+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}

function generateChunkId(source: string, index: number): string {
  const hash = source.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  return `chunk_${Math.abs(hash)}_${index}`;
}

/**
 * 智能切分 Markdown 文档
 * 优先按 ## 标题切分,长 section 再用 splitTextToChunks 切
 */
export function splitMarkdownToChunks(
  markdown: string,
  source: string,
  metadata: { title: string; path: string },
): Chunk[] {
  const chunks: Chunk[] = [];

  const sections = markdown.split(/\n(?=##\s)/);

  let chunkIndex = 0;

  for (const section of sections) {
    if (!section.trim()) continue;

    const text = extractTextFromMarkdown(section);

    if (!text) continue;

    if (text.length > 800) {
      const subChunks = splitTextToChunks(text, source, metadata, {
        chunkSize: 800,
        chunkOverlap: 150,
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

  chunks.forEach((chunk) => {
    chunk.metadata.total = chunks.length;
  });

  return chunks;
}
