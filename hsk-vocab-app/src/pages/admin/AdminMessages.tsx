import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabaseMessages, ContactMessage } from '@/services/supabase-db'
import { Mail, MailOpen, Check, Trash2, Loader2, RefreshCw, MessageSquare } from 'lucide-react'

export default function AdminMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadMessages = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await supabaseMessages.getAll()
      setMessages(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  const handleMarkRead = async (id: string) => {
    setActionLoading(id)
    try {
      await supabaseMessages.markAsRead(id)
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_read: true } : m))
      )
    } catch (err: any) {
      setError(err?.message || 'Failed to mark as read')
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkReplied = async (id: string) => {
    setActionLoading(id)
    try {
      await supabaseMessages.markReplied(id)
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, replied: true } : m))
      )
    } catch (err: any) {
      setError(err?.message || 'Failed to mark as replied')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    setActionLoading(id)
    try {
      await supabaseMessages.delete(id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to delete')
    } finally {
      setActionLoading(null)
    }
  }

  const unreadCount = messages.filter((m) => !m.is_read).length
  const selected = messages.find((m) => m.id === selectedId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Messages</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`
              : 'All messages read'}
          </p>
        </div>
        <button
          onClick={loadMessages}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {messages.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 text-ink-300 dark:text-ink-600 mx-auto mb-4" />
          <p className="text-ink-500 dark:text-ink-400 text-sm">No messages yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message List */}
          <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {messages.map((msg) => (
              <motion.button
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setSelectedId(msg.id)
                  if (!msg.is_read) handleMarkRead(msg.id)
                }}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  selectedId === msg.id
                    ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10'
                    : 'border-transparent bg-white dark:bg-ink-800 hover:bg-ink-50 dark:hover:bg-ink-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {msg.is_read ? (
                    <MailOpen className="w-4 h-4 text-ink-300 dark:text-ink-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Mail className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold truncate ${!msg.is_read ? 'text-ink-900 dark:text-white' : 'text-ink-600 dark:text-ink-300'}`}>
                        {msg.name}
                      </span>
                      {msg.replied && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium flex-shrink-0">
                          Replied
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400 dark:text-ink-500 truncate mt-0.5">{msg.email}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400 truncate mt-1">{msg.message}</p>
                    <p className="text-[10px] text-ink-400 dark:text-ink-600 mt-1.5">
                      {new Date(msg.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-ink-800 rounded-2xl border border-ink-200 dark:border-ink-700 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-ink-900 dark:text-white">{selected.name}</h2>
                    <a
                      href={`mailto:${selected.email}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {selected.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!selected.replied && (
                      <button
                        onClick={() => handleMarkReplied(selected.id)}
                        disabled={actionLoading === selected.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Mark Replied
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selected.id)}
                      disabled={actionLoading === selected.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === selected.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4 text-xs text-ink-400 dark:text-ink-500">
                  <span>
                    {new Date(selected.created_at).toLocaleString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-ink-300" />
                  <span className={selected.is_read ? 'text-ink-400' : 'text-blue-500 font-medium'}>
                    {selected.is_read ? 'Read' : 'Unread'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-ink-300" />
                  <span className={selected.replied ? 'text-green-500 font-medium' : 'text-ink-400'}>
                    {selected.replied ? 'Replied' : 'Not replied'}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-900/50 border border-ink-100 dark:border-ink-700">
                  <p className="text-sm text-ink-700 dark:text-ink-300 whitespace-pre-wrap leading-relaxed">
                    {selected.message}
                  </p>
                </div>

                <div className="mt-4">
                  <a
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent('XueTong Support')}&body=${encodeURIComponent(`Hi ${selected.name},\n\nThank you for reaching out! \n\n`)}}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.01]"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                      boxShadow: '0 4px 15px rgba(59,130,246,0.3)',
                    }}
                  >
                    <Mail className="w-4 h-4" />
                    Reply via Email
                  </a>
                </div>
              </motion.div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[300px] text-ink-400 dark:text-ink-500 text-sm">
                Select a message to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}