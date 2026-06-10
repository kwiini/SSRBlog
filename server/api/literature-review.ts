import { callLLM } from "../utils/llm";

interface PaperInput {
  name: string;
  content: string;
}

export default defineEventHandler(async (event) => {
  try {
    const { papers } = await readBody(event);

    if (!Array.isArray(papers) || papers.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "请至少上传一篇文献",
      });
    }

    // 构建文献内容摘要
    const papersText = papers
      .map(
        (p: PaperInput, idx: number) =>
          `【文献${idx + 1}】${p.name}\n${p.content.slice(0, 8000)}`
      )
      .join("\n\n---\n\n");

    const prompt = `你是一位学术文献综述专家。请仔细阅读以下 ${papers.length} 篇文献，并生成一份结构化的文献综述总结，输出为 JSON 格式。

## 文献内容

${papersText}

## 输出要求

请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记）：

{
  "field": "这些文献所属的研究领域名称（一句话概括）",
  "background": "研究背景与意义：总结这些文献共同关注的研究背景、问题来源、以及该研究的重要性。200-400字。",
  "coreContents": [
    {
      "title": "文献标题或核心主题",
      "summary": "该文献的核心观点与主要内容摘要，100-200字",
      "method": "该文献采用的主要研究方法",
      "conclusion": "该文献的主要结论或发现"
    }
  ],
  "innovation": "创新点与对比分析：对比各篇文献的创新之处，分析它们之间的异同、互补关系或争议点。200-400字。",
  "trend": "研究趋势与展望：基于这些文献，分析该领域的研究趋势、尚未解决的问题、以及未来可能的研究方向。200-400字。"
}

注意事项：
1. coreContents 数组长度应与文献数量一致，按文献顺序排列
2. 如果某篇文献信息不足，根据已有内容合理推断
3. 所有内容使用中文撰写
4. 只输出纯 JSON，不要添加任何其他文字或格式标记`;

    const response = await callLLM(prompt);

    // 清理可能的 markdown 代码块
    const cleanJson = response
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      // 如果解析失败，尝试提取 JSON 部分
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI 返回内容格式异常，请重试");
      }
    }

    // 确保 coreContents 是数组
    if (!Array.isArray(parsed.coreContents)) {
      parsed.coreContents = [];
    }

    // 补全缺失的条目
    while (parsed.coreContents.length < papers.length) {
      parsed.coreContents.push({
        title: papers[parsed.coreContents.length]?.name || "未命名文献",
        summary: "",
        method: "",
        conclusion: "",
      });
    }

    return {
      success: true,
      data: parsed,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "生成综述失败",
    });
  }
});
