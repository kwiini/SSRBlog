/**
 * GET /api/ai-config
 * 检查 LLM 关键配置(是否配了 Key、模型、BaseURL)
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  return {
    hasKey: !!config.llmApiKey && config.llmApiKey !== "",
    model: config.llmModel,
    baseURL: config.llmBaseURL,
  };
});
