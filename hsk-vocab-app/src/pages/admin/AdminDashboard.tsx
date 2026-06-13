import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminService, AdminStats } from '@/services/admin.service'
import { Users, BookOpen, BarChart3, Flame, Activity, TrendingUp, Calendar, Clock, Award, MessageSquare, Database } from 'lucide-react'

interface StorageStats {
  users: number
  activeUsers: number
  learningRecords: number
  studySessions: number
  leaderboardEntries: number
  chatSessions: number
  chatMessages: number
  chatSizeBytes: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [storage, setStorage] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminService.getStats(), adminService.getStorageStats()])
      .then(([s, st]) => {
        setStats(s)
        setStorage(st)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-ink-500 border-t-transparent" />
      </div>
    )
  }

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'bg-brand-500', suffix: '' },
    { label: 'Vocabulary', value: stats?.totalWords ?? 0, icon: BookOpen, color: 'bg-emerald-500', suffix: '' },
    { label: 'Study Sessions', value: stats?.totalSessions ?? 0, icon: Activity, color: 'bg-blue-500', suffix: '' },
    { label: 'Words Learned', value: stats?.totalProgress ?? 0, icon: TrendingUp, color: 'bg-amber-500', suffix: '' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Platform overview & activity</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="card flex items-center gap-4"
          >
            <div className={`w-11 h-11 rounded-xl ${card.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-ink-500 dark:text-ink-400">{card.label}</p>
              <p className="text-xl font-bold text-ink-900 dark:text-white truncate">
                {card.value.toLocaleString()}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Words by HSK Level */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-ink-100 dark:border-ink-700">
            <BarChart3 className="w-4 h-4 text-brand-500" />
            <h2 className="text-sm font-bold text-ink-900 dark:text-white">Words by HSK Level</h2>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((level) => {
              const entry = stats?.wordsByLevel?.find((e: any) => e.level === level)
              const count = entry?.count ?? 0
              const max = Math.max(...(stats?.wordsByLevel?.map((e: any) => e.count) ?? [1]), 1)
              const pct = max > 0 ? (count / max) * 100 : 0
              return (
                <div key={level}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        HSK {level}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-ink-700 dark:text-ink-300">{count} words</span>
                  </div>
                  <div className="h-2.5 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${['#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b'][level - 1]} 0%, ${['#a78bfa', '#f472b6', '#22d3ee', '#fbbf24'][level - 1]} 100%)`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, 3)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Users */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-ink-100 dark:border-ink-700">
            <Award className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-ink-900 dark:text-white">Top Learners</h2>
          </div>
          {stats?.topUsers?.length ? (
            <div className="space-y-2.5">
              {stats.topUsers.map((u: any, i: number) => (
                <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-50/50 dark:bg-ink-800/30">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                    i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                    i === 1 ? 'bg-gradient-to-br from-ink-300 to-ink-400' :
                    i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                    'bg-brand-500'
                  }`}>
                    {u.username?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{u.username || 'Unknown'}</p>
                    <p className="text-[10px] text-ink-500 dark:text-ink-400">{u.total_reviews || 0} words reviewed</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs font-bold text-ink-700 dark:text-ink-300">{u.streak_count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-400 dark:text-ink-500 text-center py-8">No learning activity yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-ink-100 dark:border-ink-700">
            <Users className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-ink-900 dark:text-white">Recent Users</h2>
          </div>
          {stats?.recentUsers?.length ? (
            <div className="space-y-2">
              {stats.recentUsers.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-600 dark:text-brand-400 font-semibold text-xs">
                      {u.username?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink-900 dark:text-white truncate">{u.username || 'Unknown'}</p>
                    <p className="text-[10px] text-ink-500 dark:text-ink-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-ink-300 dark:text-ink-500" />
                    <span className="text-[10px] text-ink-400 dark:text-ink-500">
                      {u.created_at?.slice(0, 10) || '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-400 dark:text-ink-500 text-center py-8">No users yet</p>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-ink-100 dark:border-ink-700">
            <Clock className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-ink-900 dark:text-white">Recent Study Activity</h2>
          </div>
          {stats?.recentSessions?.length ? (
            <div className="space-y-2">
              {stats.recentSessions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink-900 dark:text-white truncate capitalize">
                      {s.mode?.replace(/-/g, ' ') || 'study'} - {s.words_studied || 0} words
                    </p>
                    <p className="text-[10px] text-ink-500 dark:text-ink-400 truncate">
                      {s.username || 'Guest'}
                    </p>
                  </div>
                  <span className="text-[10px] text-ink-400 dark:text-ink-500">
                    {s.date?.slice(0, 10) || '-'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-400 dark:text-ink-500 text-center py-8">No study sessions yet</p>
          )}
        </div>
      </div>

      {/* Storage Stats */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-ink-100 dark:border-ink-700">
          <Database className="w-4 h-4 text-brand-500" />
          <h2 className="text-sm font-bold text-ink-900 dark:text-white">Data & Storage Overview</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/70 dark:bg-white/5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">Total Users</p>
              <p className="text-sm font-bold text-ink-900 dark:text-white">{storage?.users ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/70 dark:bg-white/5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">Study Sessions</p>
              <p className="text-sm font-bold text-ink-900 dark:text-white">{storage?.studySessions ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/70 dark:bg-white/5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">Progress Records</p>
              <p className="text-sm font-bold text-ink-900 dark:text-white">{storage?.learningRecords ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/70 dark:bg-white/5">
            <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Award className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">Leaderboard</p>
              <p className="text-sm font-bold text-ink-900 dark:text-white">{storage?.leaderboardEntries ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/70 dark:bg-white/5">
            <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">Chat Sessions</p>
              <p className="text-sm font-bold text-ink-900 dark:text-white">{storage?.chatSessions ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/70 dark:bg-white/5">
            <div className="w-9 h-9 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-pink-500" />
            </div>
            <div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">Chat Messages</p>
              <p className="text-sm font-bold text-ink-900 dark:text-white">{storage?.chatMessages ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/70 dark:bg-white/5">
            <div className="w-9 h-9 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <Database className="w-4 h-4 text-teal-500" />
            </div>
            <div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">Chat Storage</p>
              <p className="text-sm font-bold text-ink-900 dark:text-white">
                {storage ? ((storage.chatSizeBytes || 0) / 1024).toFixed(1) : '0'} KB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/70 dark:bg-white/5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/15 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">Active Users</p>
              <p className="text-sm font-bold text-ink-900 dark:text-white">{storage?.activeUsers ?? 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
