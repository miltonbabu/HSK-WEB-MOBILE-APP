import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminService, VisitorStats, VisitorTrendItem } from '@/services/admin.service'
import { Users, Calendar, TrendingUp, Trash2, AlertCircle } from 'lucide-react'

export default function AdminAnalytics() {
  const [stats, setStats] = useState<VisitorStats | null>(null)
  const [trend, setTrend] = useState<VisitorTrendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([adminService.getVisitorStats(), adminService.getVisitorTrend(14)])
      .then(([s, t]) => {
        setStats(s)
        setTrend(t)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await adminService.deleteAllVisitorData()
      setStats({ today: 0, thisWeek: 0, thisMonth: 0 })
      setTrend([])
      setMessage('All visitor data deleted successfully.')
      setShowDeleteConfirm(false)
    } catch {
      setMessage('Failed to delete visitor data.')
    } finally {
      setDeleting(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-ink-500 border-t-transparent" />
      </div>
    )
  }

  const maxCount = Math.max(...trend.map(t => t.count), 1)

  const cards = [
    { label: 'Today', value: stats?.today ?? 0, icon: Users, color: 'from-violet-500 to-purple-500' },
    { label: 'This Week', value: stats?.thisWeek ?? 0, icon: Calendar, color: 'from-blue-500 to-cyan-500' },
    { label: 'This Month', value: stats?.thisMonth ?? 0, icon: TrendingUp, color: 'from-emerald-500 to-teal-500' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900 dark:text-white">Visitor Analytics</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Unique visitors by IP hash — one IP counts once per day</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <card.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-ink-500 dark:text-ink-400">{card.label}</span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-2xl font-bold text-ink-900 dark:text-white tabular-nums">{card.value}</span>
              <span className="text-xs text-ink-400 dark:text-ink-500 mb-1">unique visitors</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Daily trend chart */}
      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-4">Daily Visitors (Last 14 Days)</h2>
        {trend.length === 0 ? (
          <p className="text-sm text-ink-400 dark:text-ink-500 text-center py-8">No visitor data yet.</p>
        ) : (
          <div className="space-y-2">
            {trend.map((item, i) => {
              const dateLabel = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const widthPct = (item.count / maxCount) * 100
              return (
                <div key={item.date} className="flex items-center gap-3">
                  <span className="text-xs text-ink-400 dark:text-ink-500 w-14 flex-shrink-0 text-right">{dateLabel}</span>
                  <div className="flex-1 h-6 bg-ink-50 dark:bg-ink-800 rounded-lg overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(widthPct, item.count > 0 ? 4 : 0)}%` }}
                      transition={{ delay: i * 0.03, duration: 0.4 }}
                      className="h-full rounded-lg"
                      style={{
                        background: item.count > 0
                          ? 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)'
                          : 'transparent',
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-ink-700 dark:text-ink-300 w-6 tabular-nums">{item.count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="card p-4 sm:p-5 border border-red-200 dark:border-red-900/30">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-white">Danger Zone</h3>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">
              Permanently delete all visitor tracking data. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete All Visitor Data
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-ink-800 rounded-2xl p-5 max-w-sm w-full shadow-xl"
          >
            <h3 className="text-base font-bold text-ink-900 dark:text-white mb-2">Delete all visitor data?</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
              This will permanently remove all visitor tracking records. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-ink-600 dark:text-ink-300 bg-ink-100 dark:bg-ink-700 hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Success/error message toast */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-lg bg-ink-900 dark:bg-ink-700 text-white text-sm font-medium z-50"
        >
          {message}
        </motion.div>
      )}
    </div>
  )
}
