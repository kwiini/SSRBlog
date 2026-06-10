/**
 * 上下文压缩模块
 * 去除冗余信息，保留关键内容
 */

// · 上下文压缩选项
interface CompressOptions {
  maxLength?: number;        // 最大长度限制
  removeDuplicates?: boolean; // 是否去除重复句子
  keepSentences?: number;     // 保留的句子数量
}

// · 默认上下文压缩选项
const DEFAULT_OPTIONS: CompressOptions = {
  maxLength: 600,
  removeDuplicates: true,
  keepSentences: 8
};

/**
 * 中文句子分割
 */
function splitSentences(text: string): string[] {
  // 按中文标点分割
  const sentences = text
    .replace(/([。！？；]+)/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // 如果没有标点，按固定长度分割
  if (sentences.length === 0) {
    const chunks: string[] = [];
    let current = '';
    for (const char of text) {
      current += char;
      if (current.length >= 50) {
        chunks.push(current);
        current = '';
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }
  
  return sentences;
}

/**
 * 计算句子相似度（基于共有词）
 */
function sentenceSimilarity(sent1: string, sent2: string): number {
  const words1 = new Set(sent1.split(''));
  const words2 = new Set(sent2.split(''));
  
  let common = 0;
  for (const word of words1) {
    if (words2.has(word)) common++;
  }
  
  return common / Math.max(words1.size, words2.size);
}

/**
 * 去除重复句子
 */
function removeDuplicateSentences(sentences: string[], threshold: number = 0.7): string[] {
  const result: string[] = [];
  
  for (const sentence of sentences) {
    let isDuplicate = false;
    
    for (const existing of result) {
      if (sentenceSimilarity(sentence, existing) > threshold) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      result.push(sentence);
    }
  }
  
  return result;
}

/**
 * 提取关键句子（基于关键词密度）
 */
function extractKeySentences(
  sentences: string[],
  keywords: string[],
  keepCount: number
): string[] {
  if (sentences.length <= keepCount) {
    return sentences;
  }
  
  // 计算每个句子的关键词密度分数
  const scoredSentences = sentences.map(sentence => {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();
    
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = lowerSentence.match(regex);
      if (matches) {
        score += matches.length * keyword.length;
      }
    }
    
    // 句子长度惩罚（避免过长句子）
    score = score / Math.sqrt(sentence.length);
    
    return { sentence, score };
  });
  
  // 按分数排序并取前 N 个
  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, keepCount)
    .sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence))  // 恢复原始顺序
    .map(s => s.sentence);
}

/**
 * 压缩文本内容
 */
export function compressText(
  text: string,
  keywords: string[] = [],
  options: CompressOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // 如果文本本身就很短，直接返回
  if (text.length <= (opts.maxLength || 600)) {
    return text;
  }
  
  // 1. 分割句子
  let sentences = splitSentences(text);
  
  // 2. 去除重复句子
  if (opts.removeDuplicates) {
    sentences = removeDuplicateSentences(sentences);
  }
  
  // 3. 提取关键句子
  if (keywords.length > 0 && opts.keepSentences) {
    sentences = extractKeySentences(sentences, keywords, opts.keepSentences);
  }
  
  // 4. 合并并截断
  let result = sentences.join('');
  
  if (result.length > (opts.maxLength || 600)) {
    result = result.substring(0, opts.maxLength) + '...';
  }
  
  return result;
}

/**
 * 压缩检索结果中的上下文
 */
export function compressContext<T extends { content: string; metadata?: { title?: string } }>(
  results: T[],
  query: string,
  options?: CompressOptions
): T[] {
  // 从查询中提取关键词
  const keywords = query
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
  
  return results.map(result => ({
    ...result,
    content: compressText(result.content, keywords, options)
  }));
}

/**
 * 智能截断 - 保留开头和结尾，去除中间
 */
export function smartTruncate(text: string, maxLength: number = 600): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  const keepLength = Math.floor(maxLength / 2) - 3;  // 每部分保留的长度
  const start = text.substring(0, keepLength);
  const end = text.substring(text.length - keepLength);
  
  return `${start}...${end}`;
}

/**
 * 移除代码块中的注释和空行
 */
export function cleanCodeBlock(code: string): string {
  return code
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // 移除纯注释行和空行
      return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('*');
    })
    .join('\n');
}

/**
 * 压缩 Markdown 内容
 */
export function compressMarkdown(markdown: string, maxLength: number = 600): string {
  // 移除 Markdown 标记但保留内容
  let text = markdown
    .replace(/```[\s\S]*?```/g, '[代码块]')  // 代码块
    .replace(/`([^`]+)`/g, '$1')              // 行内代码
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')     // 图片
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // 链接
    .replace(/[#*_>`\-]/g, '')                // 标记符号
    .replace(/\n{3,}/g, '\n\n');              // 多余空行
  
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }
  
  return text;
}
