import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generateResponse, loadSessions, saveSessions, ChatMessage, ChatSession } from '@/services/ai-chat'
import { Word } from '@/types'
import { Send, Plus, MessageSquare, Trash2, Sparkles, BookOpen, Volume2, Copy, RefreshCw, Pencil, Check, X, GraduationCap, CalendarDays, Table2, GitBranch, Lock, AlertTriangle, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useAuthStore } from '@/stores'
import { usageService } from '@/services/usage'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function WordCard({ word, onSpeak }: { word: Word; onSpeak: (chinese: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-ink-50/80 dark:bg-white/5 border border-ink-100/50 dark:border-white/10 text-xs max-w-full">
      <button
        onClick={() => onSpeak(word.chinese)}
        className="text-purple-500 hover:text-purple-600 transition-colors shrink-0"
      >
        <Volume2 className="w-3 h-3" />
      </button>
      <span className="font-bold chinese-text text-ink-900 dark:text-white shrink-0">{word.chinese}</span>
      <span className="text-ink-400 dark:text-ink-500 italic truncate">{word.pinyin}</span>
      <span className="text-ink-600 dark:text-ink-300 truncate max-w-[6rem]">{word.english.split(';')[0]}</span>
      <span className="px-1 py-0.5 rounded text-[8px] font-bold text-white bg-purple-500/80 shrink-0">{word.hsk_level}</span>
    </div>
  )
}

// Mermaid diagram renderer
function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const svgKey = useRef(0)

  useEffect(() => {
    let cancelled = false
    let mermaid: any = null

    async function render() {
      try {
        if (!mermaid) {
          const mod = await import('mermaid')
          mermaid = mod.default || mod
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: { htmlLabels: true, curve: 'basis', padding: 15 },
            themeVariables: {
              fontSize: '18px',
            },
          })
        }

        const id = `mermaid-${svgKey.current++}`
        const { svg } = await mermaid.render(id, chart.trim())
        if (cancelled || !containerRef.current) return

        // Insert SVG and make it responsive
        containerRef.current.innerHTML = svg
        const svgEl = containerRef.current.querySelector('svg')
        if (svgEl) {
          // Remove fixed width/height, keep aspect ratio
          const viewBox = svgEl.getAttribute('viewBox')
          const width = svgEl.getAttribute('width')
          const height = svgEl.getAttribute('height')

          if (!viewBox && width && height) {
            svgEl.setAttribute('viewBox', `0 0 ${parseFloat(width)} ${parseFloat(height)}`)
          }
          svgEl.style.width = '100%'
          svgEl.style.height = 'auto'
          svgEl.style.maxWidth = '100%'
          svgEl.style.display = 'block'
        }

        setError(null)
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(msg)
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart])

  if (error) {
    return (
      <div className="my-3 p-4 rounded-2xl bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/30">
        <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">Could not render diagram</div>
        <pre className="text-[11px] text-red-500 dark:text-red-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{chart}</pre>
      </div>
    )
  }

  return (
    <div className="my-4 p-5 rounded-2xl bg-white/70 dark:bg-white/5 border border-ink-100/60 dark:border-white/10 shadow-sm overflow-x-auto overflow-y-auto max-h-[600px]">
      <div
        ref={containerRef}
        className="min-h-[150px] w-full"
        style={{ minWidth: '600px' }}
      >
        <div className="text-xs text-ink-400 dark:text-ink-500 italic flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></span>
          Loading diagram...
        </div>
      </div>
    </div>
  )
}

export default function AIChat() {
  const DRAFT_KEY = 'hsk-chat-draft-v2'

  const { user, isGuest } = useAuthStore()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [input, setInput] = useState(() => localStorage.getItem(DRAFT_KEY) || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true) // desktop sidebar toggle
  const [inputFocused, setInputFocused] = useState(false) // mobile: hide header when typing
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [messagesRemaining, setMessagesRemaining] = useState<number>(() => {
    const userId = user?.id || 'guest'
    return usageService.getMessagesRemaining(userId, isGuest)
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Refresh usage counter when user or guest state changes
  useEffect(() => {
    const userId = user?.id || 'guest'
    setMessagesRemaining(usageService.getMessagesRemaining(userId, isGuest))
  }, [user?.id, isGuest])

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const messages = activeSession?.messages || []

  useEffect(() => {
    const loaded = loadSessions()
    setSessions(loaded)
    if (loaded.length > 0) {
      setActiveSessionId(loaded[0].id)
    }
  }, [])

  // Save draft input on change
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, input)
  }, [input])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const speak = (chinese: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(chinese)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.8
    window.speechSynthesis.speak(utterance)
  }

  const createSession = () => {
    // Remove any empty sessions first
    const nonEmpty = sessions.filter((s) => s.messages.length > 0)
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      userId: user?.id || 'guest',
    }
    const updated = [newSession, ...nonEmpty]
    setSessions(updated)
    saveSessions(updated)
    setActiveSessionId(newSession.id)
    setShowSidebar(false)
    inputRef.current?.focus()
  }

  const deleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id)
    setSessions(updated)
    saveSessions(updated)
    if (activeSessionId === id) {
      setActiveSessionId(updated.length > 0 ? updated[0].id : null)
    }
  }

  const updateSession = (sessionId: string, updates: Partial<ChatSession>) => {
    setSessions((prev) => {
      const updated = prev.map((s) => s.id === sessionId ? { ...s, ...updates } : s)
      saveSessions(updated)
      return updated
    })
  }

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return

    const userId = user?.id || 'guest'
    if (isGuest && !usageService.canSendMessage(userId, true)) {
      return
    }

    let sessionId = activeSessionId
    if (!sessionId) {
      const newSession: ChatSession = {
        id: generateId(),
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        userId: user?.id || 'guest',
      }
      sessionId = newSession.id
      const updated = [newSession, ...sessions]
      setSessions(updated)
      saveSessions(updated)
      setActiveSessionId(sessionId)
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    const currentMessages = [...(sessions.find((s) => s.id === sessionId)?.messages || []), userMsg]
    const title = currentMessages.length === 1 ? input.trim().slice(0, 30) : undefined

    updateSession(sessionId, {
      messages: currentMessages,
      ...(title ? { title } : {}),
    })

    setInput('')
    localStorage.removeItem(DRAFT_KEY)
    setIsGenerating(true)
    setStreamingContent('')

    try {
      const { content, words } = await generateResponse(
        currentMessages,
        (chunk) => {
          setStreamingContent((prev) => prev + chunk)
        },
        user?.username,
      )

      // Record usage after successful AI response
      if (isGuest) {
        usageService.recordMessage(userId)
        setMessagesRemaining(usageService.getMessagesRemaining(userId, true))
      }

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        words: words.length > 0 ? words : undefined,
      }

      updateSession(sessionId!, {
        messages: [...currentMessages, assistantMsg],
      })
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      }
      updateSession(sessionId!, {
        messages: [...currentMessages, errorMsg],
      })
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

  const handleCopy = async (msgId: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(msgId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRegenerate = async (msgId: string) => {
    if (!activeSessionId || isGenerating) return
    const userId = user?.id || 'guest'
    if (isGuest && !usageService.canSendMessage(userId, true)) {
      return
    }
    const session = sessions.find((s) => s.id === activeSessionId)
    if (!session) return
    const msgIndex = session.messages.findIndex((m) => m.id === msgId)
    if (msgIndex < 0) return

    // Remove this AI message and everything after
    const trimmed = session.messages.slice(0, msgIndex)
    updateSession(activeSessionId, { messages: trimmed })

    // Regenerate from the last user message
    setIsGenerating(true)
    setStreamingContent('')
    try {
      const { content, words } = await generateResponse(trimmed, (chunk) => {
        setStreamingContent((prev) => prev + chunk)
      }, user?.username)

      // Record usage after successful AI response
      if (isGuest) {
        usageService.recordMessage(userId)
        setMessagesRemaining(usageService.getMessagesRemaining(userId, true))
      }

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        words: words.length > 0 ? words : undefined,
      }
      updateSession(activeSessionId!, { messages: [...trimmed, assistantMsg] })
    } catch {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      }
      updateSession(activeSessionId!, { messages: [...trimmed, errorMsg] })
    } finally {
      setIsGenerating(false)
      setStreamingContent('')
    }
  }

  const handleDeleteMessage = (msgId: string) => {
    if (!activeSessionId) return
    const session = sessions.find((s) => s.id === activeSessionId)
    if (!session) return
    const idx = session.messages.findIndex((m) => m.id === msgId)
    if (idx < 0) return
    // Remove this message and all after it
    const trimmed = session.messages.slice(0, idx)
    updateSession(activeSessionId, { messages: trimmed })
  }

  const handleEditStart = (msgId: string, content: string) => {
    setEditingMsgId(msgId)
    setEditText(content)
  }

  const handleEditSave = async () => {
    if (!activeSessionId || !editingMsgId || !editText.trim()) return
    const userId = user?.id || 'guest'
    if (isGuest && !usageService.canSendMessage(userId, true)) {
      return
    }
    const session = sessions.find((s) => s.id === activeSessionId)
    if (!session) return

    const msgIndex = session.messages.findIndex((m) => m.id === editingMsgId)
    // Remove the edited message and everything after
    const trimmed = session.messages.slice(0, msgIndex)

    // Add the edited user message
    const editedMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: editText.trim(),
      timestamp: Date.now(),
    }

    updateSession(activeSessionId, { messages: [...trimmed, editedMsg] })
    setEditingMsgId(null)
    setEditText('')

    // Regenerate AI response
    setIsGenerating(true)
    setStreamingContent('')
    try {
      const { content, words } = await generateResponse([...trimmed, editedMsg], (chunk) => {
        setStreamingContent((prev) => prev + chunk)
      }, user?.username)

      // Record usage after successful AI response
      if (isGuest) {
        usageService.recordMessage(userId)
        setMessagesRemaining(usageService.getMessagesRemaining(userId, true))
      }

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        words: words.length > 0 ? words : undefined,
      }
      updateSession(activeSessionId!, { messages: [...trimmed, editedMsg, assistantMsg] })
    } catch {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      }
      updateSession(activeSessionId!, { messages: [...trimmed, editedMsg, errorMsg] })
    } finally {
      setIsGenerating(false)
      setStreamingContent('')
    }
  }

  const handleEditCancel = () => {
    setEditingMsgId(null)
    setEditText('')
  }

  const suggestions = [
    'What does 安排 mean?',
    'Show me HSK 4 verbs',
    'Give me a quiz',
    'How do you say important?',
  ]

  const quickActions = [
    { label: 'Grammar Help', icon: GraduationCap, message: 'Explain common HSK grammar patterns with examples' },
    { label: 'Study Plan', icon: CalendarDays, message: 'Create a personalized study plan for me based on my progress' },
    { label: 'Vocabulary Table', icon: Table2, message: 'Show me a table comparing the key HSK vocabulary words organized by level with their meaning and part of speech. Include pinyin. Please use a proper markdown table with columns: Chinese, Pinyin, Meaning, Part of Speech, HSK Level' },
    { label: 'Learning Flow Chart', icon: GitBranch, message: 'Create a flow chart showing the best order to learn Chinese from absolute beginner through HSK 4. Show the key milestones along the path. Use a mermaid flowchart.' },
  ]

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getLastMessage = (session: ChatSession) => {
    const last = [...session.messages].reverse().find((m) => m.role === 'user' || m.role === 'assistant')
    if (!last) return ''
    const preview = last.content.replace(/\*\*/g, '').replace(/\n/g, ' ').slice(0, 40)
    return preview.length < last.content.replace(/\*\*/g, '').replace(/\n/g, ' ').length ? preview + '...' : preview
  }

  const renderMarkdown = (text: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ul: ({ children }) => <ul className="ml-2 list-disc list-inside space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="ml-2 list-decimal list-inside space-y-0.5">{children}</ol>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
          code: ({ className, children }) => {
            const code = String(children).replace(/\n$/, '')
            const isMermaid = className?.includes('language-mermaid') || className?.includes('mermaid')
            if (isMermaid) {
              return <MermaidDiagram chart={code} />
            }
            return <code className="px-1 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-xs">{children}</code>
          },
          pre: ({ children }) => <pre className="p-2 rounded-lg bg-ink-100 dark:bg-ink-800 text-xs overflow-x-auto my-2">{children}</pre>,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-2xl border border-ink-100/60 dark:border-white/10 shadow-sm">
              <table className="w-full text-sm border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-purple-50 dark:bg-purple-900/20">{children}</thead>,
          th: ({ children }) => (
            <th className="px-4 py-3 text-left font-bold text-purple-700 dark:text-purple-300 text-sm border-b border-ink-200 dark:border-purple-900/40">
              {children}
            </th>
          ),
          tbody: ({ children }) => <tbody className="bg-white/60 dark:bg-white/[0.03]">{children}</tbody>,
          td: ({ children }) => (
            <td className="px-4 py-3 border-b border-ink-100/50 dark:border-white/5 text-ink-700 dark:text-ink-300 text-sm align-top">
              {children}
            </td>
          ),
          tr: ({ children }) => <tr className="hover:bg-purple-50/40 dark:hover:bg-purple-900/10 transition-colors">{children}</tr>,
        }}
      >
        {text}
      </ReactMarkdown>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] sm:h-[calc(100vh-8rem)] -m-3 sm:-m-6">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-10 sm:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - toggleable on desktop */}
      <AnimatePresence initial={false}>
        {(showSidebar || sidebarOpen) && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`${showSidebar ? 'fixed' : 'hidden sm:flex'} z-20 top-0 bottom-0 left-0 w-72 sm:w-56 lg:w-64 bg-white dark:bg-ink-900 backdrop-blur-xl border-r border-ink-100 dark:border-ink-800 flex-col pt-safe overflow-hidden`}
          >
            <div className="p-3 border-b border-ink-100 dark:border-ink-800 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={createSession}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                    boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                    color: 'white',
                  }}
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
                {/* Desktop collapse button */}
                <button
                  onClick={() => { setSidebarOpen(false); setShowSidebar(false) }}
                  className="hidden sm:flex p-2 rounded-lg hover:bg-ink-50 dark:hover:bg-white/5 text-ink-400 dark:text-ink-500 transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    session.id === activeSessionId
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-white/5'
                  }`}
                  onClick={() => { setActiveSessionId(session.id); setShowSidebar(false) }}
                >
                  <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium truncate">{session.title}</span>
                      <span className="text-[9px] text-ink-400 dark:text-ink-500 shrink-0">{formatTime(session.createdAt)}</span>
                    </div>
                    {getLastMessage(session) && (
                      <p className="text-[11px] text-ink-400 dark:text-ink-500 truncate mt-0.5">{getLastMessage(session)}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                    className="sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-500 transition-all shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-center text-xs text-ink-400 dark:text-ink-500 py-8">No conversations yet</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - hidden on mobile when input focused */}
        <div className={`${inputFocused ? 'hidden sm:flex' : 'flex'} items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-b border-ink-100 dark:border-ink-800 bg-white/50 dark:bg-ink-900/50 backdrop-blur-xl`}>
          {/* Desktop expand sidebar button (only when collapsed) */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden sm:flex p-1.5 rounded-lg hover:bg-ink-50 dark:hover:bg-white/5 text-ink-500 transition-colors"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowSidebar(true)}
            className="sm:hidden p-1.5 rounded-lg hover:bg-ink-50 dark:hover:bg-white/5"
          >
            <MessageSquare className="w-5 h-5 text-ink-500" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', boxShadow: '0 2px 8px rgba(139,92,246,0.3)' }}>
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-ink-900 dark:text-white">HSK AI Assistant</h1>
              <p className="hidden sm:block text-[10px] text-ink-400 dark:text-ink-500">Vocabulary & grammar knowledge base</p>
            </div>
          </div>
          {isGuest && messagesRemaining < Infinity && (
            <div className="ml-auto flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-medium"
              style={{ background: messagesRemaining <= 2 ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)', color: messagesRemaining <= 2 ? '#dc2626' : '#7c3aed' }}>
              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">{messagesRemaining} messages left today</span>
              <span className="sm:hidden">{messagesRemaining}</span>
            </div>
          )}
        </div>

        {/* Messages - scrollable area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {messages.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-3 sm:mb-4"
                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(236,72,153,0.1) 100%)' }}>
                <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
              </div>
              <h2 className="text-sm sm:text-lg font-bold text-ink-900 dark:text-white mb-1">HSK Study Assistant</h2>
              <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400 max-w-sm mb-3 sm:mb-6">
                Ask about Chinese vocabulary, grammar, or get practice quizzes.
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full max-w-sm mb-3">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => { setInput(action.message); inputRef.current?.focus() }}
                    className="flex flex-col items-center gap-1 px-2 py-2 sm:py-3 rounded-xl text-[10px] sm:text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all border border-purple-200/50 dark:border-purple-700/30"
                  >
                    <action.icon className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
                    <span className="text-center leading-tight">{action.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 sm:gap-2 justify-center max-w-sm">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus() }}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium bg-ink-50 dark:bg-white/5 text-ink-600 dark:text-ink-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all border border-ink-100/50 dark:border-white/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[92%] sm:max-w-[75%]`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md sm:rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}>
                        <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-semibold text-ink-400 dark:text-ink-500">AI</span>
                    </div>
                  )}

                  {/* Editing mode for user messages */}
                  {editingMsgId === msg.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave() } }}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-white dark:bg-ink-800 border-2 border-purple-400 outline-none resize-none text-ink-900 dark:text-white"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={handleEditCancel} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700 transition-colors">
                          <X className="w-3 h-3" /> Cancel
                        </button>
                        <button onClick={handleEditSave} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}>
                          <Check className="w-3 h-3" /> Save & Resend
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-md'
                        : 'bg-ink-50/80 dark:bg-white/5 text-ink-800 dark:text-ink-200 rounded-bl-md border border-ink-100/30 dark:border-white/5'
                    }`} style={msg.role === 'user' ? {
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                    } : undefined}>
                      {renderMarkdown(msg.content)}
                    </div>
                  )}

                  {/* Action buttons */}
                  {editingMsgId !== msg.id && (
                    <div className={`flex items-center gap-0.5 sm:gap-1 mt-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <>
                          <button onClick={() => handleCopy(msg.id, msg.content)} className="p-1.5 sm:p-1 rounded-md text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-300 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
                            {copiedId === msg.id ? <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-green-500" /> : <Copy className="w-3.5 h-3.5 sm:w-3 sm:h-3" />}
                          </button>
                          <button onClick={() => handleRegenerate(msg.id)} disabled={isGenerating} className="p-1.5 sm:p-1 rounded-md text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-300 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40">
                            <RefreshCw className={`w-3.5 h-3.5 sm:w-3 sm:h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                          </button>
                          <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 sm:p-1 rounded-md text-ink-400 dark:text-ink-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </button>
                        </>
                      )}
                      {msg.role === 'user' && (
                        <>
                          <button onClick={() => handleEditStart(msg.id, msg.content)} className="p-1.5 sm:p-1 rounded-md text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-300 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
                            <Pencil className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </button>
                          <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 sm:p-1 rounded-md text-ink-400 dark:text-ink-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {msg.role === 'assistant' && msg.words && msg.words.length > 0 && (
                    <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1 sm:gap-1.5">
                      {msg.words.slice(0, 5).map((w) => (
                        <WordCard key={w.id} word={w} onSpeak={speak} />
                      ))}
                      {msg.words.length > 5 && (
                        <span className="text-[10px] text-gray-400 self-center ml-1">
                          +{msg.words.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming response */}
          {isGenerating && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[90%] sm:max-w-[75%]">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md sm:rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}>
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-ink-400 dark:text-ink-500">AI</span>
                </div>
                <div className="rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed bg-ink-50/80 dark:bg-white/5 text-ink-800 dark:text-ink-200 border border-ink-100/30 dark:border-white/5">
                  {renderMarkdown(streamingContent)}
                  <span className="inline-block w-1.5 h-3.5 sm:h-4 bg-purple-500 animate-pulse ml-0.5 align-text-bottom" />
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isGenerating && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3 bg-ink-50/80 dark:bg-white/5 border border-ink-100/30 dark:border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md sm:rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}>
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                  </div>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input - always visible at bottom */}
        <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-ink-100 dark:border-ink-800 bg-white/70 dark:bg-ink-900/70 backdrop-blur-xl safe-bottom">
          <div className="max-w-3xl mx-auto">
            {isGuest && messagesRemaining <= 0 ? (
              <div className="flex flex-col items-center gap-2 bg-red-50/60 dark:bg-red-900/10 border border-red-200/60 dark:border-red-900/30 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-400">Daily message limit reached</span>
                </div>
                <p className="text-[11px] sm:text-xs text-red-600/70 dark:text-red-400/70">
                  Free users can send {usageService.getLimit()} messages per day.{' '}
                  <a href="/auth" className="font-medium underline hover:text-red-700">Create an account</a> for unlimited chat.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2 bg-ink-50/60 dark:bg-white/5 border border-ink-200/60 dark:border-white/10 rounded-2xl px-2.5 sm:px-3 py-1.5 sm:py-2 focus-within:border-purple-400 dark:focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="Ask about HSK vocabulary..."
                    rows={1}
                    className="flex-1 bg-transparent resize-none px-1 py-1.5 text-xs sm:text-sm text-ink-900 dark:text-white placeholder:text-ink-400 dark:placeholder:text-ink-500 outline-none max-h-28"
                    style={{ minHeight: '24px' }}
                    disabled={isGenerating}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isGenerating}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: input.trim() && !isGenerating
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)'
                        : 'rgba(139,92,246,0.15)',
                      boxShadow: input.trim() && !isGenerating ? '0 2px 8px rgba(139,92,246,0.3)' : 'none',
                      color: input.trim() && !isGenerating ? 'white' : '#8b5cf6',
                    }}
                  >
                    <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
                <p className="hidden sm:block text-[10px] text-ink-400 dark:text-ink-500 text-center mt-1.5">
                  Enter to send · Shift+Enter for new line
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
