import type { Message } from './types'

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const API_KEY = import.meta.env.VITE_ZHIPU_API_KEY as string
const MODEL = 'glm-4-flash'

interface ChatCompletionChunk {
  choices: {
    delta: { content?: string }
    finish_reason: string | null
  }[]
}

export async function sendMessage(
  messages: Message[],
  onChunk: (content: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!API_KEY) {
    throw new Error('未配置 API Key，请在 .env 文件中设置 VITE_ZHIPU_API_KEY')
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: messages.map(({ role, content }) => ({ role, content })),
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`API 请求失败 (${response.status}): ${errorText || '未知错误'}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取响应流')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') return

        try {
          const chunk: ChatCompletionChunk = JSON.parse(data)
          const content = chunk.choices[0]?.delta?.content
          if (content) onChunk(content)
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
