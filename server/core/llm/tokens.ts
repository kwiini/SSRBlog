/**
 * Token 数量粗略估算
 * 规则:1 中文字 ≈ 1.5 token,1 英文词 ≈ 1.3 token,标点/数字 ≈ 0.5 token
 * 仅供分批决策使用,不需要精确
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x4e00 && code <= 0x9fff) {
      tokens += 1.5; // CJK 统一汉字
    } else if (/[a-zA-Z]/.test(ch)) {
      tokens += 0.25; // 英文字母(4 字母 ≈ 1 token)
    } else if (/\d/.test(ch)) {
      tokens += 0.5;
    } else {
      tokens += 0.5; // 标点、空格等
    }
  }
  return Math.ceil(tokens);
}
