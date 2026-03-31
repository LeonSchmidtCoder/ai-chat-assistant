import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import type { Message } from '../types'
import { sendMessage } from '../api'
import MessageBubble from './MessageBubble'

const STORAGE_KEY = 'chat-history'

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(messages: Message[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>(loadHistory)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(scrollToBottom, [messages, scrollToBottom])

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setError(null)
    const userMessage: Message = { role: 'user', content: text, timestamp: Date.now() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    const assistantMessage: Message = { role: 'assistant', content: '', timestamp: Date.now() }
    setMessages([...updatedMessages, assistantMessage])

    abortRef.current = new AbortController()

    try {
      await sendMessage(
        updatedMessages,
        (chunk) => {
          assistantMessage.content += chunk
          assistantMessage.timestamp = Date.now()
          setMessages((prev) => [...prev.slice(0, -1), { ...assistantMessage }])
        },
        abortRef.current.signal,
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || '发送失败，请重试')
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleClear = () => {
    if (loading) {
      abortRef.current?.abort()
    }
    setMessages([])
    setError(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const adjustTextareaHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-gray-800">AI 聊天助手</h1>
        <button
          onClick={handleClear}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          清空对话
        </button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
              <span className="text-2xl text-indigo-500">AI</span>
            </div>
            <p className="text-lg font-medium text-gray-500">你好，有什么可以帮你？</p>
            <p className="text-sm mt-1">输入问题开始对话</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {loading && messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start mb-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0 mt-1">
              AI
            </div>
            <div className="mx-2 px-4 py-3 rounded-2xl rounded-bl-sm bg-white shadow-sm border border-gray-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Error toast */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Input area */}
      <footer className="bg-white border-t border-gray-200 p-4 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              adjustTextareaHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入消息...（Shift+Enter 换行）"
            disabled={loading}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-2.5 text-[15px] leading-relaxed focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-10 w-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  )
}
