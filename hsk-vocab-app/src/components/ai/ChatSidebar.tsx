import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Trash2,
  PanelLeftClose,
  Sparkles,
  MessageCircle,
  GraduationCap,
  X,
  TrendingUp,
  Flame,
  Zap,
  BarChart3,
  BookOpen,
  Target,
} from 'lucide-react'
import { ChatSession } from '@/services/ai-chat'
import { AIMode, AI_MODES } from '@/data/aiModes'

interface ChatSidebarProps {
  open: boolean
  isMobile: boolean
  sessions: ChatSession[]
  activeId: string | null
  onCreate: (mode: AIMode) => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
  currentMode: AIMode
  /** Quick stats shown in the sidebar footer. */
  stats?: {
    wordsLearned?: number
    streak?: number
    messagesRemaining?: number
  }
}

function formatTime(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getLastMessage(session: ChatSession) {
  const last = [...session.messages].reverse().find((m) => m.role === 'user' || m.role === 'assistant')
  if (!last) return ''
  const preview = last.content.replace(/\*\*/g, '').replace(/\n/g, ' ').slice(0, 50)
  return preview.length < last.content.length ? preview + '…' : preview
}

const MODE_ICONS: Record<AIMode, any> = {
  chat: Sparkles,
  conversation: MessageCircle,
  grammar: GraduationCap,
}

const MODE_COLORS: Record<AIMode, string> = {
  chat: '#8b5cf6',
  conversation: '#ec4899',
  grammar: '#6366f1',
}

const MODE_LABELS: Record<AIMode, string> = {
  chat: 'Free Chat',
  conversation: 'Conversation',
  grammar: 'Grammar',
}

const MODE_DESCRIPTIONS: Record<AIMode, string> = {
  chat: 'Ask anything about HSK',
  conversation: 'Practice real scenarios',
  grammar: 'Master Chinese patterns',
}

export default function ChatSidebar({
  open,
  isMobile,
  sessions,
  activeId,
  onCreate,
  onSelect,
  onDelete,
  onClose,
  currentMode,
  stats,
}: ChatSidebarProps) {
  return (
    <>
      {/* Backdrop (mobile only) */}
      <AnimatePresence>
        {isMobile && open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            key="sidebar"
            initial={isMobile ? { x: '-100%' } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
            exit={isMobile ? { x: '-100%' } : { width: 0, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            className={`${
              isMobile ? 'fixed' : 'relative'
            } z-50 top-0 bottom-0 left-0 bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800 flex flex-col overflow-hidden`}
            style={isMobile ? { width: '88%', maxWidth: 360 } : { width: 320 }}
          >
            {/* Header */}
            <div className="p-3 border-b border-ink-100 dark:border-ink-800 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-ink-900 dark:text-white">AI Tutor</h2>
                {isMobile ? (
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-ink-50 dark:hover:bg-white/5 text-ink-500"
                    aria-label="Close sidebar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-ink-50 dark:hover:bg-white/5 text-ink-400 dark:text-ink-500"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick mode switcher — three big buttons */}
              <div className="space-y-1.5">
                {AI_MODES.map((mode) => {
                  const Icon = MODE_ICONS[mode.id]
                  const color = MODE_COLORS[mode.id]
                  const isCurrent = mode.id === currentMode
                  return (
                    <button
                      key={mode.id}
                      onClick={() => onCreate(mode.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
                        isCurrent
                          ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/40'
                          : 'bg-ink-50/60 dark:bg-white/5 border border-transparent hover:border-ink-200 dark:hover:border-white/10'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: isCurrent
                            ? `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`
                            : `${color}1a`,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: isCurrent ? 'white' : color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-ink-900 dark:text-white truncate">
                          {MODE_LABELS[mode.id]}
                        </div>
                        <div className="text-[10px] text-ink-500 dark:text-ink-400 truncate">
                          {MODE_DESCRIPTIONS[mode.id]}
                        </div>
                      </div>
                      {isCurrent && (
                        <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-white dark:bg-purple-900/40 px-1.5 py-0.5 rounded">
                          ON
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Session list — scrollable, fills remaining height */}
            <div className="flex-1 overflow-y-auto p-2 min-h-0">
              <div className="px-2 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                  Recent
                </span>
                <span className="text-[10px] text-ink-400 dark:text-ink-500">
                  {sessions.length} {sessions.length === 1 ? 'chat' : 'chats'}
                </span>
              </div>
              {sessions.length === 0 ? (
                <div className="px-2 py-6 text-center">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-ink-50 dark:bg-white/5 flex items-center justify-center mb-2">
                    <MessageCircle className="w-4 h-4 text-ink-400" />
                  </div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">No conversations yet</p>
                  <p className="text-[10px] text-ink-400 dark:text-ink-500 mt-0.5">
                    Pick a mode above to start
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {sessions.map((session) => {
                    const mode = session.mode || 'chat'
                    const Icon = MODE_ICONS[mode]
                    const color = MODE_COLORS[mode]
                    const isActive = session.id === activeId
                    return (
                      <div
                        key={session.id}
                        onClick={() => onSelect(session.id)}
                        className={`group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all ${
                          isActive
                            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                            : 'text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <Icon
                          className="w-3.5 h-3.5 shrink-0 mt-0.5"
                          style={!isActive ? { color } : undefined}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium truncate">
                              {session.title}
                            </span>
                            <span className="text-[9px] text-ink-400 dark:text-ink-500 shrink-0 tabular-nums">
                              {formatTime(session.createdAt)}
                            </span>
                          </div>
                          {getLastMessage(session) && (
                            <p className="text-[10px] text-ink-400 dark:text-ink-500 truncate mt-0.5">
                              {getLastMessage(session)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(session.id)
                          }}
                          className="sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-500 transition-all shrink-0"
                          aria-label="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer — learning snapshot + useful links */}
            <div className="border-t border-ink-100 dark:border-ink-800 flex-shrink-0 p-2.5 space-y-2 bg-ink-50/50 dark:bg-white/[0.02]">
              {/* Learning snapshot */}
              {(stats?.wordsLearned !== undefined ||
                stats?.streak !== undefined ||
                stats?.messagesRemaining !== undefined) && (
                <div className="grid grid-cols-3 gap-1.5">
                  {stats?.streak !== undefined && stats.streak > 0 && (
                    <div className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-ink-100 dark:border-white/10">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-xs font-bold text-ink-900 dark:text-white tabular-nums">
                        {stats.streak}
                      </span>
                      <span className="text-[8px] text-ink-400 dark:text-ink-500 uppercase tracking-wide">
                        day
                      </span>
                    </div>
                  )}
                  {stats?.wordsLearned !== undefined && stats.wordsLearned > 0 && (
                    <div className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-ink-100 dark:border-white/10">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-bold text-ink-900 dark:text-white tabular-nums">
                        {stats.wordsLearned}
                      </span>
                      <span className="text-[8px] text-ink-400 dark:text-ink-500 uppercase tracking-wide">
                        words
                      </span>
                    </div>
                  )}
                  {stats?.messagesRemaining !== undefined && stats.messagesRemaining < Infinity && (
                    <div className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-ink-100 dark:border-white/10">
                      <Zap className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-xs font-bold text-ink-900 dark:text-white tabular-nums">
                        {stats.messagesRemaining}
                      </span>
                      <span className="text-[8px] text-ink-400 dark:text-ink-500 uppercase tracking-wide">
                        msgs
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-1.5">
                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-white/5 border border-ink-100 dark:border-white/10 text-ink-600 dark:text-ink-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
                >
                  <BarChart3 className="w-3 h-3" />
                  Dashboard
                </Link>
                <Link
                  to="/learn"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-white/5 border border-ink-100 dark:border-white/10 text-ink-600 dark:text-ink-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
                >
                  <Target className="w-3 h-3" />
                  Learn
                </Link>
                <Link
                  to="/vocabulary"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-white/5 border border-ink-100 dark:border-white/10 text-ink-600 dark:text-ink-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
                >
                  <BookOpen className="w-3 h-3" />
                  Words
                </Link>
                <Link
                  to="/plan"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-white/5 border border-ink-100 dark:border-white/10 text-ink-600 dark:text-ink-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
                >
                  <TrendingUp className="w-3 h-3" />
                  Plan
                </Link>
              </div>

              <p className="text-[9px] text-ink-400 dark:text-ink-500 text-center leading-relaxed">
                AI knows your level · {AI_MODES.length} modes available
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
