/**
 * 学术论文关键章节提取工具
 * 从长文本中抽取"摘要/方法/结果/结论"等关键章节，
 * 跳过参考文献、致谢、附录等冗余部分，节省 LLM token。
 */

interface SectionMatch {
  name: string;
  start: number;
  end: number;
  priority: number; // 1=核心 2=次要 3=辅助
}

// 关键章节匹配模式（中英文）
const SECTION_PATTERNS: Array<{ name: string; regex: RegExp; priority: number }> = [
  { name: "abstract", regex: /(?:^|\n)\s*(?:#+\s*)?(?:abstract|summary|摘\s*要|概\s*要|摘\s*录)[:：\s]*\n?/i, priority: 1 },
  { name: "conclusion", regex: /(?:^|\n)\s*(?:#+\s*)?(?:conclusions?|concluding\s+remarks?|结\s*论|总\s*结|结\s*语|结\s*束\s*语)[:：\s]*\n?/i, priority: 1 },
  { name: "method", regex: /(?:^|\n)\s*(?:#+\s*)?(?:method(?:ology|ologies|s)?|materials?\s+and\s+methods?|experimental\s+(?:section|setup)|方\s*法|材\s*料\s*与\s*方\s*法|研\s*究\s*方\s*法|实\s*验\s*方\s*法)[:：\s]*\n?/i, priority: 2 },
  { name: "result", regex: /(?:^|\n)\s*(?:#+\s*)?(?:results?|findings?|experiments?(?:\s+and\s+results?)?|结\s*果|实\s*验\s*结\s*果|研\s*究\s*结\s*果)[:：\s]*\n?/i, priority: 2 },
  { name: "introduction", regex: /(?:^|\n)\s*(?:#+\s*)?(?:introduction|引\s*言|前\s*言|绪\s*论|1[\s.、]*(?:Introduction|引言))[:：\s]*\n?/i, priority: 3 },
  { name: "discussion", regex: /(?:^|\n)\s*(?:#+\s*)?(?:discussion|讨\s*论|分\s*析\s*与\s*讨\s*论)[:：\s]*\n?/i, priority: 3 },
];

// 终止关键词（章节到此为止）
const STOP_KEYWORDS = [
  /\b(?:references?|bibliography)\b[:：\s]*\n?/i,
  /(?:^|\n)\s*(?:#+\s*)?(?:参\s*考\s*文\s*献|引\s*用\s*文\s*献)[:：\s]*\n?/i,
  /\b(?:acknowledg(?:e)?ments?)\b[:：\s]*\n?/i,
  /(?:^|\n)\s*(?:#+\s*)?(?:致\s*谢|鸣\s*谢)[:：\s]*\n?/i,
  /\bappendi(?:x|ces)\b[:：\s]*\n?/i,
  /(?:^|\n)\s*(?:#+\s*)?附\s*录[:：\s]*\n?/i,
  /\b(?:author\s+(?:contributions?|bio(?:graphy)?|information))\b/i,
];

/**
 * 寻找某个起始位置之后的下一个章节或终止词位置
 */
function findNextBoundary(text: string, start: number): number {
  let earliest = text.length;
  const allPatterns = [
    ...SECTION_PATTERNS.map((p) => p.regex),
    ...STOP_KEYWORDS,
  ];
  for (const re of allPatterns) {
    // 使用新实例以避免共享 lastIndex 状态，并启用 global 标志
    const globalRe = new RegExp(re.source, re.flags + "g");
    const searchText = text.slice(start);
    const m = searchText.match(globalRe);
    if (m && m.index !== undefined && m.index > 50) {
      // 至少留 50 字符再判定为下一章节
      earliest = Math.min(earliest, start + m.index);
    }
  }
  return earliest;
}

/**
 * 提取学术论文中的关键章节
 * @param text 原始文本
 * @param maxLength 单篇论文提取后最大字符数（默认 6000）
 * @returns 提取后的关键章节文本
 */
export function extractKeySections(text: string, maxLength = 6000): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;

  // 匹配所有章节起始位置
  const matches: SectionMatch[] = [];
  for (const pat of SECTION_PATTERNS) {
    const m = text.match(pat.regex);
    if (m && m.index !== undefined) {
      matches.push({
        name: pat.name,
        start: m.index,
        end: findNextBoundary(text, m.index + m[0].length),
        priority: pat.priority,
      });
    }
  }

  // 去重：同一位置可能匹配多个模式
  const uniqueMatches = new Map<number, SectionMatch>();
  for (const m of matches) {
    if (!uniqueMatches.has(m.start) || uniqueMatches.get(m.start)!.priority > m.priority) {
      uniqueMatches.set(m.start, m);
    }
  }
  const deduped = Array.from(uniqueMatches.values()).sort((a, b) => a.start - b.start);

  if (deduped.length === 0) {
    // 无结构化章节：取首 50% + 末 50%，中间用省略标记
    const headLen = Math.floor(maxLength * 0.5);
    const tailLen = maxLength - headLen - 30;
    return (
      text.slice(0, headLen).trim() +
      "\n\n[...中间内容省略...]\n\n" +
      text.slice(-tailLen).trim()
    );
  }

  // 限制每个章节的最大长度，避免单个章节撑爆预算
  const maxPerSection = Math.ceil(maxLength * 0.4);
  const parts: string[] = [];
  let total = 0;

  // 优先抽取高优先级章节，按 priority 升序，再按 start 升序
  const ordered = [...deduped].sort(
    (a, b) => a.priority - b.priority || a.start - b.start
  );

  for (const sec of ordered) {
    if (total >= maxLength) break;
    const raw = text.slice(sec.start, sec.end).trim();
    if (!raw) continue;
    const remaining = maxLength - total;
    const slice = raw.length > maxPerSection
      ? raw.slice(0, maxPerSection) + "\n[…本节截断…]"
      : raw.slice(0, remaining);
    parts.push(`【${labelOf(sec.name)}】\n${slice}`);
    total += slice.length;
  }

  return parts.join("\n\n");
}

function labelOf(name: string): string {
  const map: Record<string, string> = {
    abstract: "摘要",
    conclusion: "结论",
    method: "方法",
    result: "结果",
    introduction: "引言",
    discussion: "讨论",
  };
  return map[name] || name;
}
