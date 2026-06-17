import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, RefreshCw, Trash2, Pencil, Check, X, Sparkles } from 'lucide-react'
import { ChatMessage } from '@/services/ai-chat'
import WordActionCard from './WordActionCard'

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  isEditing: boolean
  onSpeak: (chinese: string) => void
  onCopy: (msgId: string, content: string) => Promise<void>
  onRegenerate?: (msgId: string) => void
  onDelete: (msgId: string) => void
  onEditStart?: (msgId: string) => void
  onEditSave?: (msgId: string, newContent: string) => void
  onEditCancel?: () => void
  copiedId: string | null
  isGenerating: boolean
  mermaidRenderer?: (chart: string) => React.ReactNode
}

export default function MessageBubble({
  message,
  isStreaming = false,
  isEditing,
  onSpeak,
  onCopy,
  onRegenerate,
  onDelete,
  onEditStart,
  onEditSave,
  onEditCancel,
  copiedId,
  isGenerating,
  mermaidRenderer,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [editText, setEditText] = useState(message.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing) {
      setEditText(message.content)
      // focus on next tick
      setTimeout(() => {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(message.content.length, message.content.length)
      }, 0)
    }
  }, [isEditing, message.content])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className="max-w-[92%] sm:max-w-[80%] min-w-0">
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <div
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
            >
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-ink-500 dark:text-ink-400">
              小明 · AI Tutor
            </span>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (editText.trim() && onEditSave) onEditSave(message.id, editText.trim())
                }
                if (e.key === 'Escape' && onEditCancel) {
                  onEditCancel()
                }
              }}
              className="w-full rounded-xl px-3 py-2 text-sm bg-white dark:bg-ink-800 border-2 border-red-400 outline-none resize-none text-ink-900 dark:text-white"
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={onEditCancel}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700 transition-colors"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                onClick={() => editText.trim() && onEditSave && onEditSave(message.id, editText.trim())}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
              >
                <Check className="w-3 h-3" /> Save & Resend
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-[13px] leading-relaxed break-words ${
              isUser
                ? 'text-white rounded-br-md'
                : 'bg-white/80 dark:bg-white/5 text-ink-800 dark:text-ink-200 rounded-bl-md border border-ink-100/60 dark:border-white/10'
            }`}
            style={
              isUser
                ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }
                : undefined
            }
          >
            <MarkdownContent content={message.content} mermaidRenderer={mermaidRenderer} />
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 sm:h-4 bg-red-500 animate-pulse ml-0.5 align-text-bottom" />
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isEditing && (
          <div
            className={`flex items-center gap-0.5 sm:gap-1 mt-1 px-1 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {!isUser && (
              <>
                <button
                  onClick={() => onCopy(message.id, message.content)}
                  className="p-1.5 sm:p-1 rounded-md text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-300 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors"
                  aria-label="Copy"
                  title="Copy"
                >
                  {copiedId === message.id ? (
                    <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  )}
                </button>
                {onRegenerate && (
                  <button
                    onClick={() => onRegenerate(message.id)}
                    disabled={isGenerating}
                    className="p-1.5 sm:p-1 rounded-md text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-300 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
                    aria-label="Regenerate"
                    title="Regenerate"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 sm:w-3 sm:h-3 ${
                        isGenerating ? 'animate-spin' : ''
                      }`}
                    />
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => onDelete(message.id)}
              className="p-1.5 sm:p-1 rounded-md text-ink-400 dark:text-ink-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              aria-label="Delete"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
            </button>
            {isUser && onEditStart && (
              <button
                onClick={() => onEditStart(message.id)}
                className="p-1.5 sm:p-1 rounded-md text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-300 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors"
                aria-label="Edit"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
              </button>
            )}
          </div>
        )}

        {/* Word cards */}
        {!isUser && !isStreaming && message.words && message.words.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {message.words.slice(0, 4).map((w) => (
              <WordActionCard key={w.id} word={w} onSpeak={onSpeak} />
            ))}
            {message.words.length > 4 && (
              <span className="text-[10px] text-ink-400 dark:text-ink-500 px-1">
                +{message.words.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function MarkdownContent({
  content,
  mermaidRenderer,
}: {
  content: string
  mermaidRenderer?: (chart: string) => React.ReactNode
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        ul: ({ children }) => <ul className="ml-2 list-disc list-inside space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="ml-2 list-decimal list-inside space-y-0.5">{children}</ol>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        code: ({ className, children }) => {
          const code = String(children).replace(/\n$/, '')
          const isMermaid = className?.includes('language-mermaid') || className?.includes('mermaid')
          if (isMermaid && mermaidRenderer) {
            return <>{mermaidRenderer(code)}</>
          }
          return <code className="px-1 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-xs">{children}</code>
        },
        pre: ({ children }) => (
          <pre className="p-2 rounded-lg bg-ink-100 dark:bg-ink-800 text-xs overflow-x-auto my-2">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-xl border border-ink-100/60 dark:border-white/10">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-red-50 dark:bg-red-900/20">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-bold text-red-700 dark:text-red-300 text-xs border-b border-ink-200 dark:border-red-900/40">
            {children}
          </th>
        ),
        tbody: ({ children }) => <tbody className="bg-white/60 dark:bg-white/[0.03]">{children}</tbody>,
        td: ({ children }) => (
          <td className="px-3 py-2 border-b border-ink-100/50 dark:border-white/5 text-ink-700 dark:text-ink-300 text-xs align-top">
            {children}
          </td>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-red-50/40 dark:hover:bg-red-900/10 transition-colors">
            {children}
          </tr>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-red-400 hover:decoration-red-600"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
