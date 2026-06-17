import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore, useProgressStore } from '@/stores'
import { MessageSquare, Send, Sparkles, ChevronLeft, Volume2 } from 'lucide-react'
import {
  CONVERSATION_SCENARIOS,
  ConversationScenario,
  ConversationTurn,
  generateConversationResponse,
} from '@/services/ai-features'
import { recordStudySession } from '@/utils/study-helpers'
import SEO from '@/components/SEO/Helmet'
import { PAGE_SEO } from '@/utils/seo'

type Phase = 'setup' | 'chat'

export default function ConversationMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const [phase, setPhase] = useState<Phase>('setup')
  const [scenario, setScenario] = useState<ConversationScenario | null>(null)
  const [history, setHistory] = useState<ConversationTurn[]>([])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionStartRef = useRef(Date.now())

  const filteredScenarios = CONVERSATION_SCENARIOS.filter((s) => s.level <= selectedLevel + 1)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, streamingContent])

  const speak = (chinese: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(chinese)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.75
    window.speechSynthesis.speak(utterance)
  }

  const startConversation = async (s: ConversationScenario) => {
    setScenario(s)
    setPhase('chat')
    setHistory([])
    setInput('')
    sessionStartRef.current = Date.now()

    // Generate opening message
    setIsGenerating(true)
    try {
      const response = await generateConversationResponse(s, [], 'Hello!')
      setHistory([response])
    } catch (err) {
      console.error('Failed to start conversation:', err)
      setHistory([{ role: 'partner', content: '你好！欢迎光临！', pinyin: 'Nǐ hǎo! Huānyíng guānglín!', translation: 'Hello! Welcome!', corrections: [] }])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || !scenario || isGenerating) return

    const userTurn: ConversationTurn = { role: 'user', content: input.trim() }
    const newHistory = [...history, userTurn]
    setHistory(newHistory)
    setInput('')
    setIsGenerating(true)
    setStreamingContent('')

    try {
      const response = await generateConversationResponse(scenario, newHistory, input.trim())
      setHistory([...newHistory, response])
    } catch (err) {
      console.error('Conversation failed:', err)
      setHistory([...newHistory, { role: 'partner', content: '对不起，我不明白。', pinyin: 'Duìbuqǐ, wǒ bù míngbái.', translation: "Sorry, I don't understand.", corrections: [] }])
    } finally {
      setIsGenerating(false)
      setStreamingContent('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const endConversation = () => {
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const totalTurns = history.filter((t) => t.role === 'user').length
    if (totalTurns > 0) {
      recordStudySession(user?.id || 'guest', 'shadowing', totalTurns, 100, duration)
    }
    setPhase('setup')
  }

  // ── Setup ──
  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <SEO {...PAGE_SEO.conversation} />
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', boxShadow: '0 8px 25px rgba(20,184,166,0.35)' }}>
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Conversation Partner</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Practice real-life conversations in Chinese. AI adapts to your HSK {selectedLevel} level.
          </p>
        </div>

        <div className="space-y-3">
          {filteredScenarios.map((s) => (
            <motion.button
              key={s.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => startConversation(s)}
              className="card card-hover w-full flex items-center gap-4 p-4 text-left"
            >
              <span className="text-3xl">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.description}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                  HSK {s.level}
                </span>
              </div>
              <Sparkles className="w-4 h-4 text-teal-500 shrink-0" />
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  // ── Chat ──
  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-12rem)]">
      {/* Compact chat bar — back/exit is essential since the chat is
          full-screen, but we keep it small to avoid duplicating the
          global top nav. */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <button
          onClick={endConversation}
          className="p-2 rounded-xl text-ink-500 dark:text-ink-400 hover:bg-white/30 dark:hover:bg-white/10 transition-colors"
          aria-label="End conversation"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xl shrink-0">{scenario?.icon}</span>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-ink-900 dark:text-white truncate">
            {scenario?.title}
          </h1>
          <p className="text-[11px] text-ink-500 dark:text-ink-400">
            AI Conversation Partner • HSK {selectedLevel}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3">
        {history.map((turn, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] space-y-1`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                turn.role === 'user'
                  ? 'text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md'
              }`} style={turn.role === 'user' ? { background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' } : undefined}>
                <p className="chinese-text">{turn.content}</p>
              </div>

              {turn.role === 'partner' && (
                <div className="space-y-0.5 ml-1">
                  {turn.pinyin && (
                    <p className="text-xs text-teal-600 dark:text-teal-400 italic">{turn.pinyin}</p>
                  )}
                  {turn.translation && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{turn.translation}</p>
                  )}
                  {turn.corrections && turn.corrections.length > 0 && (
                    <div className="mt-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30">
                      <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">Corrections:</p>
                      {turn.corrections.map((c, j) => (
                        <p key={j} className="text-[10px] text-amber-600 dark:text-amber-400">{c}</p>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => speak(turn.content)}
                    className="flex items-center gap-1 text-[10px] text-teal-500 hover:text-teal-600 transition-colors"
                  >
                    <Volume2 className="w-3 h-3" /> Listen
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isGenerating && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-gray-100 dark:bg-gray-800">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0">
        <div className="flex items-end gap-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2 focus-within:border-teal-400 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response in Chinese…"
            rows={1}
            className="flex-1 bg-transparent resize-none px-1 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none max-h-28"
            disabled={isGenerating}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-30"
            style={{
              background: input.trim() && !isGenerating ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' : 'rgba(20,184,166,0.15)',
              color: input.trim() && !isGenerating ? 'white' : '#14b8a6',
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}