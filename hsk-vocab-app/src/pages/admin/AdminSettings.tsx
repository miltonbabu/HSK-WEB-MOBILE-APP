import { useState, useEffect } from 'react'
import { adminService, isSuperAdminEmail, SystemSettings } from '@/services/admin.service'
import { useAdminStore } from '@/stores'
import {
  Settings as SettingsIcon, Save, AlertTriangle, RefreshCw, CheckCircle,
  Shield, MessageSquare, Users, Trash2, Lock
} from 'lucide-react'

export default function AdminSettings() {
  const { admin } = useAdminStore()
  const isSuper = isSuperAdminEmail(admin?.email)
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [resetConfirm, setResetConfirm] = useState(false)
  const [clearAllConfirm, setClearAllConfirm] = useState(false)

  useEffect(() => {
    adminService.getSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    try {
      await adminService.updateSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    try {
      await adminService.resetDatabase()
      setResetConfirm(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to reset')
    }
  }

  const handleClearAllUsersData = async () => {
    try {
      const result = await adminService.clearAllUsersData()
      setClearAllConfirm(false)
      setError('')
      // use a lightweight toast-like alert by briefly showing saved banner with a message
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      console.info('Clear all summary:', result)
    } catch (err: any) {
      setError(err.message || 'Failed to clear')
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-ink-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">Settings</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Configure application behavior</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary !px-4 !py-2 text-sm flex items-center gap-1.5"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* General Settings */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-ink-100 dark:border-ink-700">
            <SettingsIcon className="w-4 h-4 text-brand-500" />
            <h2 className="text-sm font-bold text-ink-900 dark:text-white">General</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1.5">Site Name</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1.5">Description</label>
              <textarea
                value={settings.description}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1.5">
                Default Daily Goal (words per day)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={settings.defaultDailyGoal}
                onChange={(e) => setSettings({ ...settings, defaultDailyGoal: parseInt(e.target.value) || 20 })}
                className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30"
              />
            </div>
          </div>
        </div>

        {/* User Limits */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-ink-100 dark:border-ink-700">
            <Users className="w-4 h-4 text-brand-500" />
            <h2 className="text-sm font-bold text-ink-900 dark:text-white">User Access</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1.5">
                Guest Daily Message Limit
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.guestDailyLimit}
                onChange={(e) => setSettings({ ...settings, guestDailyLimit: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-400/30"
              />
              <p className="text-[10px] text-ink-400 dark:text-ink-500 mt-1">Non-registered users will be limited to this many AI chat messages per day.</p>
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 cursor-pointer hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-brand-500" />
                <div>
                  <p className="text-sm font-medium text-ink-900 dark:text-white">Allow New Signups</p>
                  <p className="text-[10px] text-ink-500 dark:text-ink-400">Enable user registration on the auth page</p>
                </div>
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors ${settings.signupEnabled ? 'bg-brand-500' : 'bg-ink-300 dark:bg-ink-600'}`}>
                <button
                  onClick={() => setSettings({ ...settings, signupEnabled: !settings.signupEnabled })}
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${settings.signupEnabled ? 'left-6' : 'left-1'}`}
                />
              </div>
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 cursor-pointer hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-brand-500" />
                <div>
                  <p className="text-sm font-medium text-ink-900 dark:text-white">AI Chat Enabled</p>
                  <p className="text-[10px] text-ink-500 dark:text-ink-400">Allow users to access the AI chat feature</p>
                </div>
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors ${settings.aiChatEnabled ? 'bg-brand-500' : 'bg-ink-300 dark:bg-ink-600'}`}>
                <button
                  onClick={() => setSettings({ ...settings, aiChatEnabled: !settings.aiChatEnabled })}
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${settings.aiChatEnabled ? 'left-6' : 'left-1'}`}
                />
              </div>
            </label>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card lg:col-span-2 border-2 border-red-200/50 dark:border-red-900/30">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-red-100 dark:border-red-900/30">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-red-600 dark:text-red-400">Danger Zone</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10">
              <div>
                <p className="text-sm font-medium text-ink-900 dark:text-white">Reset All Learning Data</p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">Clears all study sessions, progress tracking, and leaderboard data. User accounts and vocabulary are preserved.</p>
              </div>
              {isSuper ? (!resetConfirm ? (
                <button onClick={() => setResetConfirm(true)} className="btn-secondary !px-3 !py-1.5 text-xs flex items-center gap-1.5 !text-red-600 dark:!text-red-400 !bg-red-100/50 dark:!bg-red-900/20 !border-red-200/50">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">Confirm?</span>
                  <button onClick={() => setResetConfirm(false)} className="px-2.5 py-1 rounded-lg text-xs bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors">No</button>
                  <button onClick={handleReset} className="px-2.5 py-1 rounded-lg text-xs bg-red-500 text-white hover:bg-red-600 transition-colors">Yes, reset</button>
                </div>
              )) : (
                <span className="text-[11px] text-ink-400 dark:text-ink-500 italic inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Super Admin only
                </span>
              )}
            </div>

            <div className="flex items-start justify-between p-3 rounded-xl bg-red-50/40 dark:bg-red-900/10 border border-red-200/50 dark:border-red-900/30">
              <div>
                <p className="text-sm font-medium text-ink-900 dark:text-white">Clear All Users Data + Chats</p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">For every user — clear learning progress, study sessions, leaderboard, AI chat history, and streak counters. Accounts are preserved.</p>
              </div>
              {isSuper ? (!clearAllConfirm ? (
                <button onClick={() => setClearAllConfirm(true)} className="btn-secondary !px-3 !py-1.5 text-xs flex items-center gap-1.5 !text-red-600 dark:!text-red-400 !bg-red-100/60 dark:!bg-red-900/20 !border-red-300/60">
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">Really clear all?</span>
                  <button onClick={() => setClearAllConfirm(false)} className="px-2.5 py-1 rounded-lg text-xs bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors">No</button>
                  <button onClick={handleClearAllUsersData} className="px-2.5 py-1 rounded-lg text-xs bg-red-500 text-white hover:bg-red-600 transition-colors">Yes, clear all</button>
                </div>
              )) : (
                <span className="text-[11px] text-ink-400 dark:text-ink-500 italic inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Super Admin only
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
