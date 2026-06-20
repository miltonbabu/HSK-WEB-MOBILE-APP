import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useSettingsStore } from '@/stores'
import { Moon, Target, Clock, Volume2, Info, Database, Download, RotateCcw } from 'lucide-react'
import { createBackup, listBackups, restoreBackup, getLastBackupTime, type BackupMetadata } from '@/services/db-backup'

const goalOptions = [10, 20, 50, 100]
const timerOptions = [5, 10, 15, 30]
const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5]

export default function Settings() {
  const {
    darkMode,
    toggleDarkMode,
    dailyGoal,
    setDailyGoal,
    playbackSpeed,
    setPlaybackSpeed,
    quizTimer,
    setQuizTimer,
  } = useSettingsStore()

  const [backups, setBackups] = useState<BackupMetadata[]>([])
  const [lastBackup, setLastBackup] = useState(0)
  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)

  const refreshBackups = useCallback(async () => {
    setBackups(await listBackups())
    setLastBackup(getLastBackupTime())
  }, [])

  useEffect(() => {
    void refreshBackups()
  }, [refreshBackups])

  const handleBackup = useCallback(async () => {
    setBackupBusy(true)
    try {
      await createBackup()
      await refreshBackups()
    } finally {
      setBackupBusy(false)
    }
  }, [refreshBackups])

  const handleRestore = useCallback(async (timestamp: number) => {
    setBackupBusy(true)
    try {
      const ok = await restoreBackup(timestamp)
      if (ok) {
        setRestoreMsg('Backup restored. Reloading the page…')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setRestoreMsg('Restore failed — backup not found.')
      }
    } finally {
      setBackupBusy(false)
    }
  }, [])

  const formatTime = (ts: number) => {
    if (!ts) return 'Never'
    const diff = Date.now() - ts
    if (diff < 60_000) return 'Just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`
    return new Date(ts).toLocaleDateString()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Settings</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Customize your learning experience</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5 text-ink-500 dark:text-ink-400" />
            <h3 className="font-medium text-ink-900 dark:text-white">Appearance</h3>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative w-12 h-7 rounded-full transition-all duration-500 ${
              darkMode ? '' : 'bg-ink-200 dark:bg-ink-700'
            }`}
            style={darkMode ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' } : undefined}
            role="switch"
            aria-checked={darkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-500 ${
                darkMode ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
        <div>
          <p className="font-medium text-ink-900 dark:text-white">Dark Mode</p>
          <p className="text-sm text-ink-500 dark:text-ink-400">Switch between light and dark themes</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-red-500" />
          <h2 className="font-semibold text-ink-900 dark:text-white">Daily Goal</h2>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
          Set how many words you want to study each day
        </p>
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((goal) => (
            <motion.button
              key={goal}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDailyGoal(goal)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                dailyGoal === goal ? 'pill-active' : 'pill-inactive'
              }`}
            >
              {goal} words
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-ink-900 dark:text-white">Quiz Timer</h2>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
          Default time limit per question in timed quiz
        </p>
        <div className="flex flex-wrap gap-2">
          {timerOptions.map((seconds) => (
            <motion.button
              key={seconds}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setQuizTimer(seconds)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                quizTimer === seconds ? 'pill-active' : 'pill-inactive'
              }`}
            >
              {seconds}s
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Volume2 className="w-4 h-4 text-teal-500" />
          <h2 className="font-semibold text-ink-900 dark:text-white">Audio Playback Speed</h2>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
          Adjust the speed for listening practice
        </p>
        <div className="flex flex-wrap gap-2">
          {speedOptions.map((speed) => (
            <motion.button
              key={speed}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                playbackSpeed === speed ? 'pill-active' : 'pill-inactive'
              }`}
            >
              {speed}x
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-violet-500" />
          <h2 className="font-semibold text-ink-900 dark:text-white">Data &amp; Backup</h2>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-3">
          Back up your study progress to survive database corruption. Backups are stored in your browser (IndexedDB) and never leave this device. Last backup: <span className="font-medium">{formatTime(lastBackup)}</span>
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={handleBackup}
            disabled={backupBusy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {backupBusy ? 'Working…' : 'Back up now'}
          </button>
        </div>
        {restoreMsg && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">{restoreMsg}</p>
        )}
        {backups.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-ink-500 dark:text-ink-400 uppercase tracking-wide">Available backups</p>
            {backups.map((b) => (
              <div key={b.timestamp} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-ink-50 dark:bg-ink-800/50">
                <div className="text-sm">
                  <span className="text-ink-900 dark:text-white">{formatTime(b.timestamp)}</span>
                  <span className="text-ink-400 ml-2">({(b.size / 1024).toFixed(0)} KB, {b.tableCount} tables)</span>
                </div>
                <button
                  onClick={() => handleRestore(b.timestamp)}
                  disabled={backupBusy}
                  className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-sky-500" />
          <h2 className="font-semibold text-ink-900 dark:text-white">About</h2>
        </div>
        <div className="space-y-2 text-sm text-ink-600 dark:text-ink-400">
          <p><span className="font-medium gradient-text">XueTong</span> — HSK 3.0 Vocabulary Learning App</p>
          <p>Version 1.0.0</p>
          <p>Built with React, TypeScript, and Supabase</p>
        </div>
      </motion.div>
    </div>
  )
}