/**
 * Prompt 集中托管
 *
 * 规则:
 *   - 静态文本 → 字符串常量
 *   - 动态插值 → 函数(参数显式声明,避免隐藏依赖)
 *   - 改 prompt 只需改这一个文件,全局生效
 *   - 配套:缓存键 = model + system + user,prompt 变了缓存自动失效
 */

/* ──────────── 系统提示 ──────────── */

export const SystemPrompts = {
  /** 通用助手(aichat / llm.callLLM) */
  assistant:
    "你是一个有帮助的AI助手，请用中文回答问题。",
  /** RAG 模式:拿到参考资料时基于资料回答,拿不到直接答 */
  rag: "你是一个有帮助的AI助手。当提供参考资料时，请基于这些资料回答问题；如果没有相关资料，请直接回答用户问题。",
} as const

/* ──────────── RAG 任务提示 ──────────── */

function getRelevanceLevel(score: number): string {
  if (score >= 0.7) return "高"
  if (score >= 0.5) return "中"
  return "低"
}

export const RAGPrompts = {
  /**
   * 无上下文:仅基于通用知识回答,并告知用户未找到博客资料
   */
  noContext: (question: string) =>
    `你是博客内容的智能助手。用户提出了一个问题，但博客中没有找到相关的参考资料。

请直接回答用户问题，并说明"未在博客中找到相关资料，以下回答基于我的通用知识"。

## 用户问题：
${question}

请回答：`,

  /**
   * 完整 RAG prompt:标注相关度等级、强调忠实于资料、要求引用编号
   */
  withContext: (
    question: string,
    context: {
      hybridScore?: number
      similarity?: number
      content: string
      metadata: { title: string }
    }[],
  ) => {
    const sortedContext = context
      .slice()
      .sort(
        (a, b) => (b.hybridScore || 0) - (a.hybridScore || 0),
      )
      .map((item, index) => {
        const relevance = getRelevanceLevel(
          item.hybridScore || item.similarity || 0,
        )
        const score = (
          ((item.hybridScore || item.similarity) || 0) * 100
        ).toFixed(1)
        return `[${index + 1}] [相关度:${relevance} ${score}%] 来源：${item.metadata.title}\n内容：${item.content}`
      })
      .join("\n\n---\n\n")

    return `你是博客内容的智能助手。请基于以下参考资料回答用户问题。

## 参考资料(按相关度排序):

${sortedContext}

---

## 回答要求:
1. **优先使用高相关度资料**(标记为"高"的参考资料更可靠)
2. **综合多个来源** - 如果多个资料都相关,请整合信息给出完整回答
3. **忠实于资料** - 只回答资料中包含的信息,不要编造
4. **明确标注来源** - 在回答中引用参考资料编号,如 [1]、[2]
5. **处理信息不足的情况** - 如果资料不足以回答问题,请明确说明"根据现有资料无法确定"
6. **区分事实和推断** - 基于资料的事实 vs 你的合理推断

## 用户问题:
${question}

请根据上述要求回答问题:`
  },

  /**
   * 简化版 RAG(快速响应)
   */
  simple: (
    question: string,
    context: { content: string; metadata: { title: string } }[],
  ) => {
    const contextText = context
      .map(
        (item, index) =>
          `[${index + 1}] ${item.metadata.title}\n${item.content}`,
      )
      .join("\n\n")
    return `基于以下内容回答问题：\n\n${contextText}\n\n问题：${question}\n\n请根据资料回答，标注来源编号。`
  },
} as const

/* ──────────── HyDE(query-expansion) ──────────── */

export const HyDEPrompts = {
  /**
   * 给定问题,生成一段可能包含答案的假设文档
   */
  hypotheticalDoc: (query: string) =>
    `请根据以下问题，生成一段可能包含答案的文本段落。
这段文本应该类似于知识库中可能存在的文档内容。

问题：${query}

请生成一段 100-200 字的假设文档内容：

假设文档：`,
} as const

export const QueryPrompts = {
  /**
   * 把口语化/含错字/省略主语的用户查询改写为适合检索的短查询
   */
  rewrite: (query: string) =>
    `你是一个查询改写助手。给定用户可能口语化、含错别字、省略主语的原始问题，
改写为更适合搜索引擎/向量检索的简短查询。

要求：
1. 去除口语化语气词("那个"、"嗯"、"帮我看看"、"咋办"等)
2. 补全省略的主语和上下文("为啥报错" → "Python 报错的原因")
3. 纠正明显的错别字
4. 提取核心搜索意图，避免废话
5. 不要回答问题本身，只输出改写后的查询
6. 输出 1-2 句，不超过 30 字

原始问题：${query}

改写后：`,
} as const

/* ──────────── History 压缩(history-compressor) ──────────── */

export const HistoryPrompts = {
  /**
   * 把老对话轮次压缩为一段"前情提要",保留关键事实和意图
   * 200-300 字,避免再次超时 token 预算
   */
  summarize: (historyText: string) =>
    `你是一个对话摘要助手。以下是一段较早的对话历史(已被滑动窗口从最新对话中切出)。
请压缩为 200-300 字的"前情提要",用于给后续对话提供上下文。

要求:
1. 保留用户的关键问题、偏好、设定(命名、代词指代、上下文事实)
2. 保留模型已确认/已声明的结论,避免后续回答自相矛盾
3. 保留未解决/待跟进的问题
4. 去除寒暄、客套、重复啰嗦
5. 用第三人称概述("用户问了..."、"AI 答..."),不要直接复述对话
6. 严格控制在 300 字以内

较早的对话历史:
${historyText}

前情提要:`,
} as const

/* ──────────── Step-back / Decomposition(query-expansion) ──────────── */

export const EnhancePrompts = {
  /**
   * Step-back:把具体问题抽象成更通用的"上位问题",用于扩大检索范围
   * 例:"Vue 3 Composition API 与 Options API 区别" → "前端框架 API 设计范式对比"
   */
  stepBack: (query: string) =>
    `你是一个查询分析助手。给定用户的具体问题，生成一个更抽象、更通用的"上位问题"，
用于在检索时扩大召回范围（因为具体问题可能词面匹配不到真正相关的文档）。

# 用户的具体问题
${query}

# 要求
1. 上位问题应更抽象、覆盖面更广,描述"领域/方法/概念"而非具体场景
2. 保持与原问题相同的语言(中文/英文)
3. 1 句话即可,避免引入新实体
4. 不要回答原问题

# 示例
- 原问题:"如何优化 RAG 系统的召回率?"
  上位问题:"信息检索系统召回率优化方法"
- 原问题:"Vue 3 Composition API 与 Options API 的区别"
  上位问题:"前端框架 API 设计范式对比"
- 原问题:"How to debug memory leak in React Native?"
  上位问题:"Mobile application memory leak debugging"

# 输出
只输出上位问题本身(1 句话),不要加任何前缀或解释。`,

  /**
   * Decomposition:把复合问题拆成 2-4 个独立可检索的子问题
   * 单一问题 → shouldDecompose=false, subQuestions=[原问题]
   */
  decompose: (query: string) =>
    `你是一个查询分析助手。判断给定问题是否需要拆分为多个子问题来分别检索。
复合问题(多跳、对比、并列关系)拆为 2-4 个子问题;单一问题直接原样返回。

# 用户问题
${query}

# 拆解规则
- 对比类:"A 和 B 的区别" → 拆成 "A 是什么/特点"、"B 是什么/特点"、"A vs B 对比"
- 多跳类:"X 中 Y 的 Z" → 拆成 "X 的背景"、"Y 的角色/特点"、"Z 的细节"
- 并列类:"A、B、C 的共同点" → 拆成 A、B、C 各自的描述
- 单一具体问题:保持原样

# 输出要求
请严格输出以下 JSON(不要包含 markdown 代码块,不要添加其他文字):

{
  "shouldDecompose": true | false,
  "subQuestions": ["子问题 1", "子问题 2"]
}

约束:
- 子问题各自独立可检索,不互相依赖
- 最多 4 个子问题
- 单个问题不拆:shouldDecompose=false, subQuestions=[原问题]`,
} as const

/* ──────────── LLM Cross-Encoder 重排(reranker) ──────────── */

export const RerankPrompts = {
  /**
   * 把 (query, docs) 一起喂给 LLM 逐条打分,0-10 分
   */
  llmCrossEncoder: (query: string, docsText: string) =>
    `请评估以下文档与用户查询的相关性。

用户查询: ${query}

文档列表:
${docsText}

请为每个文档评分(0-10分),并返回 JSON 格式:
{
  "scores": [
    {"index": 1, "score": 8.5, "reason": "直接回答了查询"},
    {"index": 2, "score": 3.0, "reason": "部分相关"}
  ]
}

只返回 JSON,不要其他内容。`,
} as const

/* ──────────── RAG 评估(rag-eval) ──────────── */

export const EvalPrompts = {
  contextPrecision: (question: string, list: string) =>
    `你是检索质量评估员。判断下列每个文档是否与问题相关。
问题：${question}

文档列表：
${list}

请输出严格 JSON(不要其他内容、不要 markdown 包裹):
{"relevance": [1, 0, 1, ...]}

每个元素 1=相关 0=不相关,顺序与文档一致。`,

  contextRecall: (question: string, groundTruth: string, list: string) =>
    `你是检索召回评估员。给定问题、标准答案、检索到的上下文,
判断标准答案中的关键信息是否能在上下文中找到。

问题：${question}

标准答案：${groundTruth}

检索到的上下文：
${list || "（无）"}

请输出严格 JSON：
{"recall": 0.0 到 1.0 之间的小数, "missing": ["标准答案里没被检索覆盖的关键点"]}

recall=1.0 表示完全覆盖,0.0 表示完全没覆盖。`,

  faithfulness: (question: string, ctxText: string, answer: string) =>
    `你是幻觉检测员。逐条提取答案中的事实性声明,判断每条是否被上下文支撑。

问题：${question}

上下文：
${ctxText || "（无）"}

答案：${answer}

请输出严格 JSON：
{"claims": [{"text": "声明1", "supported": true|false}, ...], "score": 0.0 到 1.0}

score = supported 的声明数 / 总声明数;没有声明时 score=1.0。`,

  answerRelevancy: (question: string, answer: string) =>
    `你是答案质量评估员。判断下列答案是否切题并回答了用户问题。

问题：${question}

答案：${answer}

请输出严格 JSON：
{"relevance": 0.0 到 1.0 之间的小数, "reason": "一句话说明"}

0=完全跑题,1=完美切题。`,
} as const

/* ──────────── 综述生成(review-generator) ──────────── */

export const ReviewPrompts = {
  /** Map 阶段:单篇论文 → 结构化摘要 */
  map: (name: string, content: string) =>
    `你是一位学术文献分析专家。请仔细阅读以下文献内容，提取关键信息用于后续综述。

# 文献名称
${name}

# 文献内容
${content || "（无内容）"}

# 输出要求
请严格输出以下 JSON 格式(不要包含 markdown 代码块标记,不要添加任何其他文字):
{
  "title": "文献标题(如能识别则填文献名,否则填原文件名)",
  "summary": "该文献的核心观点、研究目的与主要内容的精炼摘要,150-250字",
  "method": "该文献采用的主要研究方法、技术路线或实验手段,50-150字",
  "conclusion": "该文献的主要结论、关键发现或核心贡献,50-150字"
}

要求:
1. 必须输出合法 JSON,所有字段值使用中文
2. 若文献内容信息不足,对应字段可填空字符串
3. 不要输出 JSON 之外的任何内容`,

  /** Reduce 阶段:一批摘要 → 综述 */
  reduce: (count: number, papersText: string, batchInfo: string) =>
    `你是一位学术文献综述专家。以下是 ${count} 篇文献的预提取信息，请在此基础上生成结构化文献综述。${batchInfo}

# 各篇文献核心信息(已按 [1]..[${count}] 编号)
${papersText}

# 引用约定
- 在 background / innovation / trend 段落中,每条具体声明必须紧跟方括号引用,例如:
  · "Smith 等人[1]提出了基于 Transformer 的方法"  → 引用 [1]
  · "对比 [1] 和 [2] 的方法,可以发现..."  → 同时引用 [1][2]
  · "类似结论在多篇文献[1][3][5]中得到验证"  → 多个引用
- coreContents 数组里的 summary/method/conclusion 不需要再加 [N](数组下标已经表达归属)
- 引用编号 [N] 对应上文"各篇文献核心信息"中第 N 条(从 1 开始)
- 严禁引用不存在的编号(如 [0] 或 > ${count} 的数字)
- 严禁编造跨论文的事实(如"[1]和[2]都用 X 方法",除非 [1] 和 [2] 的方法字段里都明确出现 X)

# 输出要求
请严格按以下 JSON 格式输出(不要包含 markdown 代码块标记,不要添加任何其他文字):

{
  "field": "这些文献所属的研究领域名称(一句话概括)",
  "background": "研究背景与意义:综合这些文献共同关注的研究背景、问题来源、以及该研究的重要性。200-400字。带 [N] 引用。",
  "coreContents": [
    {
      "title": "对应文献的标题",
      "summary": "该文献的核心观点与主要内容摘要,100-200字",
      "method": "该文献采用的主要研究方法",
      "conclusion": "该文献的主要结论或发现"
    }
  ],
  "innovation": "创新点与对比分析:对比各篇文献的创新之处,分析它们之间的异同、互补关系或争议点。200-400字。带 [N] 引用。",
  "trend": "研究趋势与展望:基于这些文献,分析该领域的研究趋势、尚未解决的问题、以及未来可能的研究方向。200-400字。带 [N] 引用。"
}

要求:
1. coreContents 数组长度应与文献数量一致,按文献顺序排列
2. 直接复用各篇预提取的 summary/method/conclusion,必要时润色
3. 所有内容使用中文撰写
4. 严格输出纯 JSON`,

  /** Merge 阶段:多批中间综述 → 最终综述 */
  merge: (intermediateCount: number, summariesCount: number, partsText: string) =>
    `你是一位学术文献综述专家。以下是对 ${summariesCount} 篇文献分 ${intermediateCount} 批生成的中间综述，请将它们合并为一份完整、连贯的最终综述。

# 各批综述内容
${partsText}

# 引用约定
- 在最终综述的 background / innovation / trend 段落中,每条具体声明必须紧跟方括号引用,例如 [1]、[2][5]、[1][3][4]
- 引用编号 [N] 对应原始文献第 N 篇(从 1 开始,范围 1..${summariesCount})
- 严禁引用超出 1..${summariesCount} 范围的编号
- 严禁编造不存在的跨论文事实
- coreContents 数组里的字段不需要再加 [N] 引用

# 输出要求
请严格按以下 JSON 格式输出(不要包含 markdown 代码块标记,不要添加任何其他文字):

{
  "field": "所有文献所属的研究领域名称(一句话概括)",
  "background": "综合所有批次的背景信息,撰写统一的研究背景与意义。300-600字。带 [N] 引用。",
  "coreContents": [
    {
      "title": "对应文献的标题",
      "summary": "该文献的核心观点与主要内容摘要,100-200字",
      "method": "该文献采用的主要研究方法",
      "conclusion": "该文献的主要结论或发现"
    }
  ],
  "innovation": "综合所有批次的创新点分析,进行跨批次的对比与综合。300-600字。带 [N] 引用。",
  "trend": "综合所有批次的研究趋势,撰写统一的研究展望。300-600字。带 [N] 引用。"
}

要求:
1. coreContents 数组长度必须为 ${summariesCount},按文献顺序排列
2. 背景和创新点分析需要跨批次综合,不要简单拼接
3. 所有内容使用中文撰写
4. 严格输出纯 JSON`,

  /**
   * FactCheck 阶段:把综述里的声明跟原始摘要对一遍,标幻觉 / 错配
   * 输出 JSON: { "verdict": "pass"|"revise"|"fail", "issues": [...] }
   */
  factCheck: (paperCount: number, reviewJson: string, papersText: string) =>
    `你是一位严格的学术审稿人，任务是核查以下综述里的每一条事实性声明，
判断它们是否能在给定的原始文献摘要中找到依据。

# 原始文献摘要(共 ${paperCount} 篇)
${papersText}

# 待核查的综述
${reviewJson}

请逐条核查综述中的事实性声明,判断它们是否能被原始文献摘要支撑。

# 输出 JSON
请严格输出以下 JSON(不要包含 markdown 代码块,不要添加其他文字):
{
  "verdict": "pass" | "revise" | "fail",
  "score": 0.0 到 1.0 之间的可信度分数,
  "issues": [
    {
      "field": "出问题的字段路径(如 'background'、'innovation'、'coreContents[0].summary' 等)",
      "severity": "unsupported" | "misattributed",
      "quote": "原文中需要被核查的那句声明(简短引用)",
      "reason": "为什么这条声明有问题"
    }
  ]
}

判断规则:
- verdict=pass: 没有发现任何无依据的声明
- verdict=revise: 存在少数(1-2 条)可疑声明,综述整体可用但需标注
- verdict=fail: 存在多条严重无依据声明,综述不可信
- score=1.0 表示完全可信,0.0 表示完全不可信`,
} as const
