import { useState, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Lock, Sparkles, Home } from 'lucide-react'
import { useAuthStore } from '@/stores'
import { usageService } from '@/services/usage'
import { progressService } from '@/services/sqlite-api'
import { chatHistory } from '@/services/chat-history'
import {
  generateResponse,
  ChatMessage,
  ChatSession,
  GRAMMAR_PATTERNS,
} from '@/services/ai-chat'
import {
  AIMode,
  AI_MODE_BY_ID,
  SCENARIO_BY_ID,
  ConversationScenario,
} from '@/data/aiModes'
import ChatSidebar from '@/components/ai/ChatSidebar'
import AIModeTabs from '@/components/ai/AIModeTabs'
import ContextCard from '@/components/ai/ContextCard'
import EmptyState from '@/components/ai/EmptyState'
import MessageBubble from '@/components/ai/MessageBubble'
import InputBar from '@/components/ai/InputBar'
import MermaidDiagram from '@/components/ai/MermaidDiagram'

const DRAFT_KEY = 'hsk-chat-draft-v3'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function getInitialDraft() {
  try {
    return localStorage.getItem(DRAFT_KEY) || ''
  } catch {
    return ''
  }
}

export default function AIChat() {
  const { user, isGuest } = useAuthStore()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<AIMode>('chat')
  const [activeScenario, setActiveScenario] = useState<ConversationScenario | null>(null)
  const [activePattern, setActivePattern] = useState<typeof GRAMMAR_PATTERNS[number] | null>(null)
  const [input, setInput] = useState(getInitialDraft)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true) // desktop sidebar
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false) // mobile drawer
  const [messagesRemaining, setMessagesRemaining] = useState<number>(() => {
    const userId = user?.id || 'guest'
    return usageService.getMessagesRemaining(userId, isGuest)
  })
  const [wordsLearned, setWordsLearned] = useState(0)
  const [streak, setStreak] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Refresh usage counter when user or guest state changes
  useEffect(() => {
    const userId = user?.id || 'guest'
    setMessagesRemaining(usageService.getMessagesRemaining(userId, isGuest))
  }, [user?.id, isGuest])

  // Load real learning stats (words learned + streak) so the sidebar can
  // show a "learning snapshot" card with numbers that actually move.
  useEffect(() => {
    const userId = user?.id || 'guest'
    let cancelled = false
    ;(async () => {
      try {
        const progress = await progressService.getUserProgress(userId)
        if (cancelled) return
        const learned = progress.filter((p: any) => (p.mastery_level ?? 0) >= 3).length
        setWordsLearned(learned)
      } catch {
        /* DB not ready yet — sidebar will just hide the tile */
      }
    })()
    try {
      const raw = localStorage.getItem('hsk-streak')
      if (raw) {
        const parsed = JSON.parse(raw) as { count?: number }
        setStreak(parsed.count ?? 0)
      }
    } catch {
      /* ignore */
    }
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Load sessions — from DB for registered users, from localStorage for guests
  useEffect(() => {
    const userId = user?.id || 'guest'
    let cancelled = false
    ;(async () => {
      const loaded = await chatHistory.load({ userId, isGuest })
      if (cancelled) return
      setSessions(loaded)
      if (loaded.length > 0) {
        const first = loaded[0]
        setActiveSessionId(first.id)
        if (first.mode) setActiveMode(first.mode)
        if (first.contextId && first.mode === 'conversation') {
          setActiveScenario(SCENARIO_BY_ID[first.contextId] || null)
        }
        if (first.contextId && first.mode === 'grammar') {
          const p = GRAMMAR_PATTERNS.find((g) => g.name === first.contextId) || null
          setActivePattern(p)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, isGuest])

  // Save draft input on change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, input)
    } catch {
      /* noop */
    }
  }, [input])

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const messages = useMemo(() => activeSession?.messages || [], [activeSession])

  // Scroll to bottom when messages change
  useEffect(() => {
    const el = messagesEndRef.current
    if (el) {
      // only smooth-scroll if user is already near the bottom
      const container = messagesContainerRef.current
      if (container) {
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        if (distFromBottom < 200) {
          el.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    }
  }, [messages, streamingContent])

  const speak = (chinese: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(chinese)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.8
    window.speechSynthesis.speak(utterance)
  }

  // ── Session management ─────────────────────────────────────────────

  // Persist the in-memory session list to wherever this user stores their
  // chat history (DB for registered, localStorage for guest). Always async
  // so we can handle the DB write without blocking the UI.
  const persistSessions = (next: ChatSession[]) => {
    const userId = user?.id || 'guest'
    void chatHistory.save(next, { userId, isGuest })
  }

  const createSession = (mode: AIMode, contextId?: string, contextTitle?: string) => {
    // Remove any empty sessions first
    const nonEmpty = sessions.filter((s) => s.messages.length > 0)
    const newSession: ChatSession = {
      id: generateId(),
      title: contextTitle || 'New chat',
      messages: [],
      createdAt: Date.now(),
      userId: user?.id || 'guest',
      mode,
      contextId,
      contextTitle,
    }
    const updated = [newSession, ...nonEmpty]
    setSessions(updated)
    persistSessions(updated)
    setActiveSessionId(newSession.id)
    setActiveMode(mode)
    setMobileSidebarOpen(false)
  }

  const deleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id)
    setSessions(updated)
    persistSessions(updated)
    if (activeSessionId === id) {
      const next = updated[0]
      setActiveSessionId(next ? next.id : null)
      if (next) {
        setActiveMode(next.mode || 'chat')
        if (next.contextId && next.mode === 'conversation') {
          setActiveScenario(SCENARIO_BY_ID[next.contextId] || null)
          setActivePattern(null)
        } else if (next.contextId && next.mode === 'grammar') {
          setActivePattern(GRAMMAR_PATTERNS.find((g) => g.name === next.contextId) || null)
          setActiveScenario(null)
        } else {
          setActiveScenario(null)
          setActivePattern(null)
        }
      } else {
        setActiveScenario(null)
        setActivePattern(null)
      }
    }
  }

  const updateSession = (sessionId: string, updates: Partial<ChatSession>) => {
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, ...updates } : s))
      persistSessions(updated)
      return updated
    })
  }

  const selectSession = (id: string) => {
    const s = sessions.find((x) => x.id === id)
    if (!s) return
    setActiveSessionId(id)
    setActiveMode(s.mode || 'chat')
    if (s.contextId && s.mode === 'conversation') {
      setActiveScenario(SCENARIO_BY_ID[s.contextId] || null)
      setActivePattern(null)
    } else if (s.contextId && s.mode === 'grammar') {
      setActivePattern(GRAMMAR_PATTERNS.find((g) => g.name === s.contextId) || null)
      setActiveScenario(null)
    } else {
      setActiveScenario(null)
      setActivePattern(null)
    }
    setMobileSidebarOpen(false)
  }

  // ── Mode switching ─────────────────────────────────────────────

  const handleModeChange = (mode: AIMode) => {
    // Switching modes just changes what's shown on the welcome screen.
    // We don't create a new session here — that only happens when the
    // user starts a new chat from the sidebar or sends their first message.
    setActiveMode(mode)
    setActiveScenario(null)
    setActivePattern(null)
  }

  const handlePickScenario = (scenario: ConversationScenario) => {
    // Just set the context — don't create a session yet. The user is still
    // browsing the welcome screen; the actual chat starts when they type
    // and send a message. This way they can compare scenarios without
    // littering the sidebar with empty sessions.
    setActiveMode('conversation')
    setActiveScenario(scenario)
    setActivePattern(null)
  }

  const handlePickPattern = (pattern: typeof GRAMMAR_PATTERNS[number]) => {
    setActiveMode('grammar')
    setActivePattern(pattern)
    setActiveScenario(null)
  }

  const handlePickQuickAction = (message: string) => {
    // Quick actions are direct prompts — fill the input box so the user
    // can review/edit and then hit send. No session until they actually send.
    setActiveMode('chat')
    setActiveScenario(null)
    setActivePattern(null)
    setInput(message)
  }

  const handleClearContext = () => {
    setActiveScenario(null)
    setActivePattern(null)
    if (activeSessionId) {
      updateSession(activeSessionId, { contextId: undefined, contextTitle: undefined })
    }
  }

  // ── Send / regenerate / edit / delete ─────────────────────────────

  const send = async (override?: { msgId?: string; content?: string }) => {
    const trimmed = (override?.content ?? input).trim()
    if (!trimmed || isGenerating) return

    const userId = user?.id || 'guest'
    if (isGuest && !usageService.canSendMessage(userId, true)) return

    // Make sure we have a session
    let sessionId = activeSessionId
    if (!sessionId) {
      const newSession: ChatSession = {
        id: generateId(),
        title: 'New chat',
        messages: [],
        createdAt: Date.now(),
        userId,
        mode: activeMode,
        contextId: activeScenario?.id || activePattern?.name,
        contextTitle: activeScenario?.title || activePattern?.name,
      }
      sessionId = newSession.id
      const updated = [newSession, ...sessions]
      setSessions(updated)
      persistSessions(updated)
      setActiveSessionId(sessionId)
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }

    const baseMessages = sessions.find((s) => s.id === sessionId)?.messages || []
    const currentMessages = override?.msgId
      ? [...baseMessages.slice(0, baseMessages.findIndex((m) => m.id === override.msgId)), userMsg]
      : [...baseMessages, userMsg]

    // Title from first user message
    const title = currentMessages.length === 1 ? trimmed.slice(0, 30) : undefined

    updateSession(sessionId, {
      messages: currentMessages,
      ...(title ? { title } : {}),
    })

    if (!override) {
      setInput('')
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* noop */
      }
    }
    setIsGenerating(true)
    setStreamingContent('')

    try {
      const { content, words } = await generateResponse(
        currentMessages,
        (chunk) => setStreamingContent((prev) => prev + chunk),
        user?.username,
        {
          mode: activeMode,
          contextId: activeScenario?.id || activePattern?.name,
          userId,
          isGuest,
        },
      )

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
      updateSession(sessionId, { messages: [...currentMessages, assistantMsg] })
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      }
      updateSession(sessionId, { messages: [...currentMessages, errorMsg] })
    } finally {
      setIsGenerating(false)
      setStreamingContent('')
    }
  }

  const handleRegenerate = async (msgId: string) => {
    if (!activeSessionId || isGenerating) return
    const userId = user?.id || 'guest'
    if (isGuest && !usageService.canSendMessage(userId, true)) return

    const session = sessions.find((s) => s.id === activeSessionId)
    if (!session) return
    const msgIndex = session.messages.findIndex((m) => m.id === msgId)
    if (msgIndex < 0) return

    const trimmed = session.messages.slice(0, msgIndex)
    updateSession(activeSessionId, { messages: trimmed })

    setIsGenerating(true)
    setStreamingContent('')
    try {
      const { content, words } = await generateResponse(
        trimmed,
        (chunk) => setStreamingContent((prev) => prev + chunk),
        user?.username,
        {
          mode: session.mode || 'chat',
          contextId: session.contextId,
          userId,
          isGuest,
        },
      )
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
      updateSession(activeSessionId, { messages: [...trimmed, assistantMsg] })
    } catch {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      }
      updateSession(activeSessionId, { messages: [...trimmed, errorMsg] })
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
    updateSession(activeSessionId, { messages: session.messages.slice(0, idx) })
  }

  const handleEditStart = (msgId: string) => {
    setEditingMsgId(msgId)
  }

  const handleEditSave = (msgId: string, newContent: string) => {
    if (!activeSessionId) return
    const session = sessions.find((s) => s.id === activeSessionId)
    if (!session) return

    const msgIndex = session.messages.findIndex((m) => m.id === msgId)
    if (msgIndex < 0) return

    const userId = user?.id || 'guest'
    if (isGuest && !usageService.canSendMessage(userId, true)) return

    // Replace the edited user message, keep everything before it, drop everything after
    const before = session.messages.slice(0, msgIndex)
    const editedMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: newContent,
      timestamp: Date.now(),
    }
    updateSession(activeSessionId, { messages: [...before, editedMsg] })
    setEditingMsgId(null)

    setIsGenerating(true)
    setStreamingContent('')
    ;(async () => {
      try {
        const { content, words } = await generateResponse(
          [...before, editedMsg],
          (chunk) => setStreamingContent((prev) => prev + chunk),
          user?.username,
          {
            mode: session.mode || 'chat',
            contextId: session.contextId,
            userId,
            isGuest,
          },
        )
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
        updateSession(activeSessionId, { messages: [...before, editedMsg, assistantMsg] })
      } catch {
        const errorMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: Date.now(),
        }
        updateSession(activeSessionId, { messages: [...before, editedMsg, errorMsg] })
      } finally {
        setIsGenerating(false)
        setStreamingContent('')
      }
    })()
  }

  const handleCopy = async (msgId: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(msgId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSuggestion = (text: string) => {
    handlePickQuickAction(text)
  }

  const handleSend = () => {
    send()
  }

  const limitReached = isGuest && messagesRemaining <= 0
  const guestLimit = usageService.getLimit()
  const modeConfig = AI_MODE_BY_ID[activeMode]

  // For empty state, show scenarios/patterns for the active mode
  const showEmpty = messages.length === 0 && !isGenerating

  return (
    <div className="flex h-[calc(100dvh-3rem)] -m-3 sm:-m-6 overflow-hidden">
      {/* Sidebar — mobile drawer + desktop collapsible */}
      <div className="hidden sm:block">
        <ChatSidebar
          open={sidebarOpen}
          isMobile={false}
          sessions={sessions}
          activeId={activeSessionId}
          currentMode={activeMode}
          onCreate={(mode) => createSession(mode)}
          onSelect={selectSession}
          onDelete={deleteSession}
          onClose={() => setSidebarOpen(false)}
          stats={{
            wordsLearned,
            streak,
            messagesRemaining,
          }}
        />
      </div>
      <div className="sm:hidden">
        <ChatSidebar
          open={mobileSidebarOpen}
          isMobile={true}
          sessions={sessions}
          activeId={activeSessionId}
          currentMode={activeMode}
          onCreate={(mode) => createSession(mode)}
          onSelect={selectSession}
          onDelete={deleteSession}
          onClose={() => setMobileSidebarOpen(false)}
          stats={{
            wordsLearned,
            streak,
            messagesRemaining,
          }}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top bar — now the only nav on this page */}
        <div
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14 border-b border-ink-100 dark:border-ink-800 flex-shrink-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.6) 100%)',
          }}
        >
          <div
            className="dark:hidden absolute inset-0 backdrop-blur-2xl"
            style={{ background: 'rgba(255,255,255,0.4)' }}
          />
          <div
            className="hidden dark:block absolute inset-0"
            style={{ background: 'rgba(20,20,35,0.7)' }}
          />

          <div className="relative flex items-center gap-2 sm:gap-3 w-full">
            {/* Sidebar trigger */}
            <button
              onClick={() => {
                if (window.innerWidth < 640) {
                  setMobileSidebarOpen(true)
                } else {
                  setSidebarOpen((v) => !v)
                }
              }}
              className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-ink-700 dark:text-ink-300 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo + title (back to home) */}
            <Link
              to="/"
              className="flex items-center gap-2 min-w-0 shrink-0"
              aria-label="Back to home"
            >
              <img
                src="/logo.png"
                alt="XueTong"
                className="h-8 w-auto object-contain sm:h-9"
              />
            </Link>

            {/* Title + subtitle */}
            <div className="hidden sm:flex items-center gap-2 min-w-0 flex-1 pl-2 ml-1 border-l border-ink-200 dark:border-ink-800">
              <div
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-ink-900 dark:text-white truncate">
                  {activeScenario
                    ? activeScenario.title
                    : activePattern
                    ? activePattern.name
                    : 'AI Tutor'}
                </h1>
                <p className="text-[10px] text-ink-500 dark:text-ink-400 truncate">
                  {modeConfig.description}
                </p>
              </div>
            </div>

            {/* Mode tabs (desktop) */}
            <div className="hidden md:flex ml-auto">
              <AIModeTabs active={activeMode} onChange={handleModeChange} />
            </div>

            {/* Usage chip (guest) */}
            {isGuest && messagesRemaining < Infinity && (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold shrink-0"
                style={{
                  background: messagesRemaining <= 2 ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)',
                  color: messagesRemaining <= 2 ? '#dc2626' : '#7c3aed',
                }}
              >
                <Lock className="w-3 h-3" />
                <span>{messagesRemaining} left today</span>
              </div>
            )}

            {/* Home button (mobile only, since there's no bottom nav on /ai) */}
            <button
              onClick={() => navigate('/')}
              className="md:hidden p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 text-ink-700 dark:text-ink-300 transition-colors ml-auto"
              aria-label="Back to home"
            >
              <Home className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile mode tabs - sticky horizontal scroll */}
        <div className="md:hidden flex overflow-x-auto gap-1.5 px-3 py-2 border-b border-ink-100 dark:border-ink-800 bg-white/50 dark:bg-ink-900/50 backdrop-blur-xl flex-shrink-0">
          <AIModeTabs active={activeMode} onChange={handleModeChange} />
        </div>

        {/* Context card (scenario / pattern) */}
        {(activeScenario || activePattern) && (
          <div className="flex-shrink-0">
            <ContextCard
              scenario={activeScenario || undefined}
              pattern={activePattern || undefined}
              onClear={handleClearContext}
            />
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 min-h-0"
        >
          {showEmpty ? (
            <EmptyState
              mode={activeMode}
              modeConfig={modeConfig}
              onSuggestion={handleSuggestion}
              onScenario={handlePickScenario}
              onPattern={handlePickPattern}
              grammarPatterns={GRAMMAR_PATTERNS}
              selectedScenarioId={activeScenario?.id}
              selectedPatternName={activePattern?.name}
            />
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isEditing={editingMsgId === msg.id}
                    onSpeak={speak}
                    onCopy={handleCopy}
                    onRegenerate={
                      activeMode === 'conversation' ? undefined : handleRegenerate
                    }
                    onDelete={handleDeleteMessage}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={() => setEditingMsgId(null)}
                    copiedId={copiedId}
                    isGenerating={isGenerating}
                    mermaidRenderer={(chart) => <MermaidDiagram chart={chart} />}
                  />
                ))}
              </AnimatePresence>

              {/* Streaming response */}
              {isGenerating && streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[92%] sm:max-w-[80%] min-w-0">
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
                    <div className="rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-[13px] leading-relaxed break-words bg-white/80 dark:bg-white/5 text-ink-800 dark:text-ink-200 border border-ink-100/60 dark:border-white/10">
                      {streamingContent}
                      <span className="inline-block w-1.5 h-3.5 sm:h-4 bg-purple-500 animate-pulse ml-0.5 align-text-bottom" />
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isGenerating && !streamingContent && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3 bg-white/80 dark:bg-white/5 border border-ink-100/60 dark:border-white/10">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
                      >
                        <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                      </div>
                      <div className="flex gap-1">
                        <span
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-400 animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-400 animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-400 animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input — always visible so the user can type even before starting */}
        <div className="border-t border-ink-100 dark:border-ink-800 bg-white/80 dark:bg-ink-900/80 backdrop-blur-xl flex-shrink-0">
          <InputBar
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={isGenerating}
            limitReached={limitReached}
            guestLimit={guestLimit}
            placeholder={
              activeMode === 'conversation'
                ? activeScenario
                  ? `Reply in Chinese as ${activeScenario.aiRole}…`
                  : 'Say something in Chinese…'
                : activeMode === 'grammar'
                ? `Ask about ${activePattern?.name || 'grammar'}…`
                : 'Ask about HSK vocabulary…'
            }
          />
        </div>
      </div>
    </div>
  )
}
