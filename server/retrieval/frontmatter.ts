/**
 * 极简 YAML frontmatter 解析器(无外部依赖)
 *
 * 特性:
 *  - 字符串值统一 unquote("…"/'…') + unescape(\" \\ \n \r \t)
 *  - 支持块式数组(`tags:\n  - a\n  - b`)
 *  - 支持流式数组(`tags: [a, b, c]`)
 *  - 空值不覆盖已有非空数组(避免重复 key 时数据被吞)
 *  - 跳过空行 / 纯注释行 / 剥行尾 # 注释(对引号内的 # 不动)
 *  - value 含冒号(URL/时间范围等)正确还原
 *
 * 不支持:多行 block scalar(| / >)、锚点(&/*)、复杂 key、引用折叠。
 * 当前 frontmatter schema(title/description/date/tags)够用。
 */

export interface FrontmatterMap {
  [key: string]: string | string[];
}

export interface ParseResult {
  frontmatter: FrontmatterMap;
  body: string;
}

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/**
 * 把双/单引号包裹的标量解包
 *  - 必须是成对引号才剥(单边引号原样返回)
 *  - 字符级状态机处理 \", \\, \n, \r, \t, \x##(顺序无关,
 *    不会出现先把 \\ 还原成 \ 后再被 \n 误转成真换行)
 *  - 未知转义序列(\u / \0 / 裸 \X 等)保留反斜杠原样
 */
function unquote(s: string): string {
  if (s.length < 2) return s;
  const first = s[0];
  const last = s[s.length - 1];
  if (!((first === '"' && last === '"') || (first === "'" && last === "'"))) {
    return s;
  }
  const inner = s.slice(1, -1);
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\" && i + 1 < inner.length) {
      const next = inner[i + 1];
      if (next === '"' || next === "'" || next === "\\") {
        out += next;
        i++;
      } else if (next === "n") {
        out += "\n";
        i++;
      } else if (next === "r") {
        out += "\r";
        i++;
      } else if (next === "t") {
        out += "\t";
        i++;
      } else if (next === "x" && i + 3 < inner.length) {
        // \x##: 2 位十六进制字节
        const hex = inner.slice(i + 2, i + 4);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 3;
        } else {
          out += c;
        }
      } else {
        // 未知转义(\u / \0 / 裸 \X 等):保留反斜杠
        out += c;
      }
    } else {
      out += c;
    }
  }
  return out;
}

function parseFlowArray(s: string): string[] | null {
  if (!s.startsWith("[") || !s.endsWith("]")) return null;
  const inner = s.slice(1, -1).trim();
  if (inner === "") return [];
  return inner
    .split(",")
    .map((x) => unquote(x.trim()))
    .filter((x) => x !== "");
}

/** 剥行尾 # 注释(忽略引号包裹值里的 #) */
function stripTrailingComment(line: string): string {
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && (inDouble || inSingle)) {
      i++;
      continue;
    }
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === "#" && !inDouble && !inSingle) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

export function parseFrontmatter(content: string): ParseResult {
  const match = content.match(FRONTMATTER_RE);
  const body = match ? (match[2] ?? "") : content;
  const frontmatter: FrontmatterMap = {};
  if (!match) return { frontmatter, body };

  const lines = match[1]?.split("\n") ?? [];
  let currentKey = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine || rawLine.trim() === "" || rawLine.trim().startsWith("#")) continue;

    const line = stripTrailingComment(rawLine);

    // 数组项
    const arrayMatch = line.match(/^\s*-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      const itemValue = arrayMatch[1]?.trim() || "";
      // 数组项里也可能是 block scalar 指示符
      if (itemValue === "|" || /^\|[+-]?$/.test(itemValue)) {
        const block = readBlockScalar(lines, i + 1, itemValue);
        if (!Array.isArray(frontmatter[currentKey])) {
          frontmatter[currentKey] = [];
        }
        (frontmatter[currentKey] as string[]).push(block.content);
        i += block.linesRead;
        continue;
      }
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = [];
      }
      (frontmatter[currentKey] as string[]).push(unquote(itemValue));
      continue;
    }

    // key: value
    const kvMatch = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2] ?? "";
      currentKey = key ?? "";

      // Block scalar: | / > / |- / |+ / >- />+
      if (/^[|>][+-]?$/.test(value)) {
        const block = readBlockScalar(lines, i + 1, value);
        if (key) frontmatter[key] = block.content;
        i += block.linesRead;
        continue;
      }

      if (value === "") {
        // 空值:不覆盖已有非空数组,否则占位 ""
        const existing = frontmatter[key!];
        if (!(Array.isArray(existing) && existing.length > 0)) {
          if (key && !Object.prototype.hasOwnProperty.call(frontmatter, key)) {
            frontmatter[key] = "";
          }
        }
      } else {
        const flow = parseFlowArray(value);
        if (key) {
          frontmatter[key] = flow ?? unquote(value);
        }
      }
    }
  }

  return { frontmatter, body };
}

/**
 * 反解 literal/folded block scalar
 *  - 后续行(空行除外)按首个非空行的缩进作为 block indent
 *  - 缩进 < block indent 视为块结束
 *  - chomping: |  (clip,单尾换行) / |- (strip,无尾) / |+ (keep,原样)
 *  - > 折叠模式:行内空白折成空格、空行折成换行(简化为 = literal,够用)
 */
function readBlockScalar(
  lines: string[],
  startIdx: number,
  indicator: string,
): { content: string; linesRead: number } {
  let blockIndent = -1;
  const contentLines: string[] = [];
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    if (line?.trim() === "") {
      // 空行算块内容
      contentLines.push("");
      i++;
      continue;
    }
    const leadingSpaces = line?.match(/^ */)?.[0].length ?? 0;
    if (blockIndent < 0) {
      // 首个非空行:0 缩进说明块没延续
      if (leadingSpaces === 0) break;
      blockIndent = leadingSpaces;
    } else if (leadingSpaces < blockIndent) {
      // 缩进回落 = 块结束
      break;
    }
    contentLines.push(line?.slice(blockIndent) || "");
    i++;
  }

  let content = contentLines.join("\n");
  const chompMatch = indicator.match(/[+-]$/);
  const chomp = chompMatch ? chompMatch[0] : "";
  if (chomp === "-") {
    // strip:去掉所有尾部换行
    content = content.replace(/\n+$/, "");
  } else if (chomp === "+") {
    // keep:原样保留所有尾部换行
  } else {
    // clip(默认):保留单个尾换行
    content = content.replace(/\n+$/, "\n");
  }

  return { content, linesRead: i - startIdx };
}
