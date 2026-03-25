import { callLLM } from "../utils/llm"

export default defineEventHandler(async (event) => {
  try {
    const { message } = await readBody(event)

    if (!message || typeof message !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Message is required and must be a string'
      })
    }

    const response = await callLLM(message)

    return {
      success: true,
      data: response
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})
