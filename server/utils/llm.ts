interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export async function callLLM(message: string): Promise<string> {
  const config = useRuntimeConfig()

  const apiKey = config.llmApiKey
  const baseURL = config.llmBaseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  const model = config.llmModel || 'qwen-max'

  if (!apiKey) {
    throw new Error('LLM API Key 未配置')
  }

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: '你是一个有帮助的AI助手，请用中文回答问题。'
    },
    {
      role: 'user',
      content: message
    }
  ]

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`LLM API error: ${response.status} - ${error}`)
    }

    const data: LLMResponse = await response.json()
    return data.choices[0]?.message?.content || '无响应内容'
  } catch (error) {
    console.error('LLM call failed:', error)
    throw error
  }
}
