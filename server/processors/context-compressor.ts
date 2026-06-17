/**
 * 上下文压缩
 *
 * - 按中文标点切句(无标点时按 50 字符硬切)
 * - 中文按 Intl.Segmenter 词粒度,英文按词,过滤停用词后做 Jaccard 相似度
 * - 去重(> 0.7 视为重复)、关键词密度排序、按原顺序拼接
 * - 单段控制在 maxLength 内(默认 600)
 *
 * 用途:RAG 拼接参考资料、对话历史压缩、综述单篇输入
 */

export interface CompressOptions {
  maxLength?: number;
  removeDuplicates?: boolean;
  keepSentences?: number;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxLength: 600,
  removeDuplicates: true,
  keepSentences: 8,
};

function splitSentences(text: string): string[] {
  const sentences = text
    .replace(/([。！？；]+)/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) {
    const chunks: string[] = [];
    let current = "";
    for (const char of text) {
      current += char;
      if (current.length >= 50) {
        chunks.push(current);
        current = "";
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  return sentences;
}

const STOPWORDS = new Set([
  "的",
  "了",
  "在",
  "是",
  "我",
  "有",
  "和",
  "就",
  "不",
  "人",
  "都",
  "一",
  "一个",
  "上",
  "也",
  "很",
  "到",
  "说",
  "要",
  "去",
  "你",
  "会",
  "着",
  "没有",
  "看",
  "好",
  "自己",
  "这",
  "那",
  "里",
  "把",
  "被",
  "从",
  "向",
  "对",
  "用",
  "将",
  "为",
  "如",
  "可",
  "则",
  "能",
  "过",
  "没",
  "而",
  "但",
  "与",
  "或",
  "及",
  "以",
  "于",
  "其",
  "此",
  "它",
  "他",
  "她",
  "们",
  "什么",
  "怎么",
  "为什么",
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "is",
  "it",
  "this",
  "that",
  "for",
  "as",
  "with",
  "by",
  "be",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "not",
  "no",
  "but",
  "if",
  "then",
]);

let zhSegmenter: Intl.Segmenter | null = null;
const enTokenRe = /[A-Za-z][A-Za-z0-9]+/g;

function getSegmenter(): Intl.Segmenter | null {
  if (zhSegmenter !== null) return zhSegmenter;
  if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
    zhSegmenter = new (Intl as any).Segmenter("zh", { granularity: "word" });
  }
  return zhSegmenter;
}

function tokenizeForSim(text: string): string[] {
  const seg = getSegmenter();
  const tokens: string[] = [];

  if (seg) {
    for (const item of seg.segment(text)) {
      if (!item.isWordLike) continue;
      const w = item.segment.toLowerCase();
      if (w.length > 1 && !STOPWORDS.has(w)) {
        tokens.push(w);
      }
    }
  } else {
    for (const ch of text) {
      if (/[\u4e00-\u9fa5]/.test(ch) && !STOPWORDS.has(ch)) {
        tokens.push(ch);
      }
    }
  }

  for (const m of text.matchAll(enTokenRe)) {
    const w = m[0].toLowerCase();
    if (!STOPWORDS.has(w)) tokens.push(w);
  }

  return tokens;
}

function sentenceSimilarity(sent1: string, sent2: string): number {
  const set1 = new Set(tokenizeForSim(sent1));
  const set2 = new Set(tokenizeForSim(sent2));

  if (set1.size === 0 || set2.size === 0) return 0;

  let inter = 0;
  for (const w of set1) if (set2.has(w)) inter++;

  const union = set1.size + set2.size - inter;
  if (union === 0) return 0;

  const jaccard = inter / union;
  const lenRatio =
    Math.min(set1.size, set2.size) / Math.max(set1.size, set2.size);
  return jaccard * (0.5 + 0.5 * lenRatio);
}

function removeDuplicateSentences(
  sentences: string[],
  threshold: number = 0.7,
): string[] {
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

function extractKeySentences(
  sentences: string[],
  keywords: string[],
  keepCount: number,
): string[] {
  if (sentences.length <= keepCount) {
    return sentences;
  }

  const keywordSet = new Set(
    keywords
      .map((k) => k.toLowerCase())
      .filter((k) => k.length > 1 && !STOPWORDS.has(k)),
  );

  const scoredSentences = sentences.map((sentence) => {
    const tokens = tokenizeForSim(sentence);
    if (tokens.length === 0) return { sentence, score: 0 };

    let score = 0;
    for (const t of tokens) {
      if (keywordSet.has(t)) score += t.length;
    }

    score = score / Math.sqrt(tokens.length);

    return { sentence, score };
  });

  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, keepCount)
    .sort(
      (a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence),
    )
    .map((s) => s.sentence);
}

/**
 * 压缩一组上下文(每项带 content 字段),保留首项的非 content 字段
 *  - 拼成一段文本 → 切句 → 去重 → 关键词打分 → 截到 maxLength
 */
export function compressContext<T extends { content: string }>(
  contexts: T[],
  query: string,
  options: CompressOptions = {},
): T[] {
  if (contexts.length === 0) return contexts;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxLength = opts.maxLength ?? 600;
  const keepSentences = opts.keepSentences ?? 8;

  const allText = contexts.map((c) => c.content).join("\n\n");
  let sentences = splitSentences(allText);

  if (opts.removeDuplicates !== false) {
    sentences = removeDuplicateSentences(sentences, 0.7);
  }

  const keywords = query
    .split(/[\s,，。.、!?？;；:：]+/)
    .filter((w) => w.length > 1);
  const keySentences = extractKeySentences(sentences, keywords, keepSentences);

  let compressed = keySentences.join("。");
  if (compressed.length > 0 && !compressed.endsWith("。")) {
    compressed += "。";
  }

  if (compressed.length > maxLength) {
    compressed = compressed.slice(0, maxLength) + "…";
  }

  const head = contexts[0]!;
  return [{ ...head, content: compressed }];
}
