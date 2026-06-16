import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, PanelLeftClose, Sparkles, MessageCircle, GraduationCap, X } from 'lucide-react'
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
}

function formatTime(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getLastMessage(session: ChatSession) {
  const last = [...session.messages].reverse().find((m) => m.role === 'user' || m.role === 'assistant')
  if (!last) return ''
  const preview = last.content.replace(/\*\*/g, '').replace(/\n/g, ' ').slice(0, 40)
  return preview.length < last.content.length ? preview + '...' : preview
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
            animate={isMobile ? { x: 0 } : { width: 280, opacity: 1 }}
            exit={isMobile ? { x: '-100%' } : { width: 0, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            className={`${
              isMobile ? 'fixed' : 'relative'
            } z-50 top-0 bottom-0 left-0 bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800 flex flex-col overflow-hidden`}
            style={isMobile ? { width: '85%', maxWidth: 320 } : { width: 280 }}
          >
            {/* Header */}
            <div className="p-3 border-b border-ink-100 dark:border-ink-800 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-ink-900 dark:text-white">Conversations</h2>
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

              {/* New chat with current mode */}
              <button
                onClick={() => onCreate(currentMode)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                }}
              >
                <Plus className="w-4 h-4" />
                New chat
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.length === 0 ? (
                <p className="text-center text-xs text-ink-400 dark:text-ink-500 py-8">
                  No conversations yet
                </p>
              ) : (
                sessions.map((session) => {
                  const mode = session.mode || 'chat'
                  const Icon = MODE_ICONS[mode]
                  const color = MODE_COLORS[mode]
                  const isActive = session.id === activeId
                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelect(session.id)}
                      className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                          : 'text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={!isActive ? { color } : undefined} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs sm:text-sm font-medium truncate">{session.title}</span>
                          <span className="text-[9px] text-ink-400 dark:text-ink-500 shrink-0">
                            {formatTime(session.createdAt)}
                          </span>
                        </div>
                        {getLastMessage(session) && (
                          <p className="text-[10px] sm:text-[11px] text-ink-400 dark:text-ink-500 truncate mt-0.5">
                            {getLastMessage(session)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(session.id)
                        }}
                        className="sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-500 transition-all shrink-0"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer hint */}
            <div className="p-3 border-t border-ink-100 dark:border-ink-800 flex-shrink-0">
              <p className="text-[10px] text-ink-400 dark:text-ink-500 leading-relaxed">
                {AI_MODES.length} modes · {sessions.length} conversation{sessions.length === 1 ? '' : 's'}
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
