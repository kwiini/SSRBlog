export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  return {
    hasKey: !!config.llmApiKey && config.llmApiKey !== '',
    model: config.llmModel,
    baseURL: config.llmBaseURL
  }
})