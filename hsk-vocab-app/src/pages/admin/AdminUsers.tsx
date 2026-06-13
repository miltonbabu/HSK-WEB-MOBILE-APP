import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { adminService, isSuperAdminEmail } from '@/services/admin.service'
import { UserProfile } from '@/types'
import { useAdminStore } from '@/stores'
import {
  Trash2, Search, Shield, ShieldOff, RefreshCw, AlertCircle, X, Check, Edit3,
  UserMinus, DatabaseZap, UserPlus, UserPlus2, KeyRound, Lock, Smartphone, Globe
} from 'lucide-react'

export default function AdminUsers() {
  const { admin } = useAdminStore()
  const isSuper = isSuperAdminEmail(admin?.email)

  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<string | null>(null)
  const [clearDataConfirm, setClearDataConfirm] = useState<string | null>(null)
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState<string | null>(null)
  const [resetPasswordForm, setResetPasswordForm] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [addForm, setAddForm] = useState({ username: '', email: '', password: '', is_admin: false })
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ username: '', email: '', is_admin: false })
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const loadUsers = () => {
    setLoading(true)
    adminService.getAllUsers().then((data) => {
      setUsers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  const filtered = users.filter((u) =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: string) => {
    try {
      await adminService.deleteUser(id)
      const u = users.find((x) => String(x.id) === id)
      const wasActive = u && (u as any).is_active !== 0 && (u as any).is_active !== false
      showToast(wasActive ? 'User deactivated' : 'User updated')
    } catch (err: any) {
      setError(err.message || 'Failed')
    } finally {
      setDeleteConfirm(null)
      loadUsers()
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await adminService.restoreUser(id)
      showToast('User restored')
    } catch (err: any) {
      setError(err.message || 'Failed')
    } finally {
      loadUsers()
    }
  }

  const handleHardDelete = async (id: string) => {
    try {
      await adminService.hardDeleteUser(id)
      showToast('User and all data permanently deleted')
    } catch (err: any) {
      setError(err.message || 'Failed')
    } finally {
      setHardDeleteConfirm(null)
      loadUsers()
    }
  }

  const handleClearUserData = async (id: string) => {
    try {
      const result = await adminService.clearUserData(id)
      showToast(
        `Cleared: ${result.progressRows || 0} progress · ${result.sessionRows || 0} sessions · ${result.leaderboardRows || 0} leaderboard · ${result.chatSessions || 0} chat sessions`
      )
    } catch (err: any) {
      setError(err.message || 'Failed')
    } finally {
      setClearDataConfirm(null)
      loadUsers()
    }
  }

  const handleResetPassword = async (id: string) => {
    try {
      if (!resetPasswordForm || resetPasswordForm.length < 4) {
        setError('Password must be at least 4 characters')
        return
      }
      await adminService.resetUserPassword(id, resetPasswordForm)
      showToast('Password has been reset')
      setResetPasswordConfirm(null)
      setResetPasswordForm('')
    } catch (err: any) {
      setError(err.message || 'Failed')
    }
  }

  const handleAddUser = async () => {
    try {
      setError('')
      const id = await adminService.createUser({
        username: addForm.username,
        email: addForm.email,
        password: addForm.password,
        is_admin: addForm.is_admin,
      })
      showToast(`User created (ID: ${id})`)
      setShowAddUser(false)
      setAddForm({ username: '', email: '', password: '', is_admin: false })
      loadUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    }
  }

  const startEdit = (user: UserProfile) => {
    setEditing(String(user.id))
    setEditForm({ username: user.username, email: user.email, is_admin: (user as any).is_admin === 1 })
    setError('')
  }

  const handleSave = async (id: string) => {
    try {
      const patch: any = { username: editForm.username, email: editForm.email }
      // only allow super admin to change admin role
      if (isSuper) patch.is_admin = editForm.is_admin
      await adminService.updateUser(id, patch)
      setEditing(null)
      showToast('User updated')
      loadUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
    }
  }

  const cancelEdit = () => {
    setEditing(null)
    setError('')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">Users</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            {users.length} registered users
            {admin && (
              <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                isSuper ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
              }`}>
                <Shield className="w-3 h-3" /> {isSuper ? 'Super Admin' : 'Admin'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAddUser(true); setError('') }}
            className="btn-primary !px-3 !py-1.5 text-xs flex items-center gap-1.5"
          >
            <UserPlus2 className="w-3.5 h-3.5" />
            Add User
          </button>
          <button onClick={loadUsers} className="btn-secondary !px-3 !py-1.5 text-xs flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-4 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-50 focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none w-full sm:w-72 text-sm"
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-ink-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-ink-400 dark:text-ink-500">
          <p className="text-lg font-medium">No users found</p>
        </div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-700 bg-ink-50/50 dark:bg-ink-800/50">
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500">User</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500 hidden sm:table-cell">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500 hidden md:table-cell">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500 hidden md:table-cell">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500 hidden lg:table-cell">Platform</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-400 dark:text-ink-500 hidden lg:table-cell">Joined</th>
                  <th className="text-right py-3 px-4 font-medium text-ink-400 dark:text-ink-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const uid = String(user.id)
                  const isEditing = editing === uid
                  const isTargetSuper = isSuperAdminEmail(user.email)
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-ink-50 dark:border-ink-800 hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        {isEditing ? (
                          <input
                            value={editForm.username}
                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-ink-200 dark:border-ink-700 rounded-lg bg-white dark:bg-ink-800 focus:ring-1 focus:ring-brand-400 outline-none"
                          />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center">
                              <span className="text-white text-xs font-semibold">
                                {user.username?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-ink-900 dark:text-white block truncate">{user.username || 'Unknown'}</span>
                              <span className="text-[10px] text-ink-400 dark:text-ink-500 sm:hidden">{user.email}</span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 hidden sm:table-cell">
                        {isEditing ? (
                          <input
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-ink-200 dark:border-ink-700 rounded-lg bg-white dark:bg-ink-800 focus:ring-1 focus:ring-brand-400 outline-none"
                          />
                        ) : (
                          <span className="text-ink-500 dark:text-ink-400 text-xs">{user.email}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 hidden md:table-cell">
                        {isEditing && isSuper && !isTargetSuper ? (
                          <button
                            onClick={() => setEditForm({ ...editForm, is_admin: !editForm.is_admin })}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                              editForm.is_admin
                                ? 'bg-ink-900 text-white'
                                : 'bg-ink-100 dark:bg-ink-700 text-ink-500 dark:text-ink-400'
                            }`}
                          >
                            {editForm.is_admin ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                            {editForm.is_admin ? 'Admin' : 'User'}
                          </button>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium ${
                            (user as any).is_admin
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400'
                          }`}>
                            <Shield className="w-3 h-3" />
                            {(user as any).is_admin ? 'Admin' : 'User'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 hidden md:table-cell">
                        {(user as any).is_active === 0 || (user as any).is_active === false ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                            <UserMinus className="w-3 h-3" /> Deactivated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                            <UserPlus className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 hidden lg:table-cell">
                        {((user as any).source === 'mobile' || !(user as any).source) ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                            <Smartphone className="w-3 h-3" /> App
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            <Globe className="w-3 h-3" /> Web
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 hidden lg:table-cell">
                        <span className="text-ink-400 dark:text-ink-500 text-xs">{user.created_at?.slice(0, 10) || '-'}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSave(uid)}
                              className="p-1.5 rounded-lg bg-jade-500 text-white hover:bg-jade-600 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded-lg bg-ink-100 dark:bg-ink-700 text-ink-500 dark:text-ink-400 hover:bg-ink-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {!isTargetSuper && (
                              <button
                                onClick={() => startEdit(user)}
                                title="Edit user"
                                className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isTargetSuper && (
                              <button
                                onClick={() => { setResetPasswordConfirm(uid); setResetPasswordForm('') }}
                                title="Reset password"
                                className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isTargetSuper && (
                              <button
                                onClick={() => setClearDataConfirm(uid)}
                                title="Clear user learning & chat data"
                                className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                              >
                                <DatabaseZap className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isSuper && !isTargetSuper ? (
                              <>
                                {(user as any).is_active === 0 || (user as any).is_active === false ? (
                                  <button
                                    onClick={() => handleRestore(uid)}
                                    title="Restore user"
                                    className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(uid)}
                                    title="Deactivate (soft delete)"
                                    className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setHardDeleteConfirm(uid)}
                                  title="Permanently delete user + data (Super Admin)"
                                  className="p-1.5 rounded-lg text-ink-400 dark:text-ink-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : null}
                            {isTargetSuper && (
                              <span className="text-[10px] text-ink-400 dark:text-ink-500 italic flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Super Admin
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-ink-800 rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900/40 flex items-center justify-center">
                  <UserMinus className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">Deactivate User</h3>
                  <p className="text-sm text-ink-500 dark:text-ink-400">Soft delete — user cannot sign in, but data is preserved.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 !py-2 text-sm">Cancel</button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-5 py-2 rounded-xl bg-slate-700 text-white font-medium text-sm hover:bg-slate-800 transition-colors"
                >
                  Deactivate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {hardDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setHardDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-ink-800 rounded-2xl p-6 max-w-sm w-full shadow-xl border-2 border-red-200/60 dark:border-red-900/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">Permanently Delete User</h3>
                  <p className="text-sm text-ink-500 dark:text-ink-400">Action cannot be undone.</p>
                </div>
              </div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-4 leading-relaxed bg-red-50/40 dark:bg-red-900/10 rounded-lg p-3">
                This will permanently remove the user account, all learning progress, study sessions, leaderboard entries, and AI chat data associated with this user.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setHardDeleteConfirm(null)} className="btn-secondary flex-1 !py-2 text-sm">Cancel</button>
                <button
                  onClick={() => handleHardDelete(hardDeleteConfirm)}
                  className="flex-1 px-5 py-2 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {clearDataConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setClearDataConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-ink-800 rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <DatabaseZap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">Clear User Data</h3>
                  <p className="text-sm text-ink-500 dark:text-ink-400">Keep the account, remove their activity.</p>
                </div>
              </div>
              <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-4 leading-relaxed bg-ink-50 dark:bg-ink-800/60 rounded-lg p-3">
                Clears learning progress, study sessions, leaderboard entries, chat sessions & streak for this user. The user account itself is preserved.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setClearDataConfirm(null)} className="btn-secondary flex-1 !py-2 text-sm">Cancel</button>
                <button
                  onClick={() => handleClearUserData(clearDataConfirm)}
                  className="flex-1 px-5 py-2 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors"
                >
                  Clear Data
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {resetPasswordConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setResetPasswordConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-ink-800 rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-sky-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">Reset Password</h3>
                  <p className="text-sm text-ink-500 dark:text-ink-400">Set a new password for this user.</p>
                </div>
              </div>
              <label className="block mb-2 text-xs text-ink-600 dark:text-ink-300">New password (min 4 chars)</label>
              <input
                type="text"
                value={resetPasswordForm}
                onChange={(e) => setResetPasswordForm(e.target.value)}
                placeholder="new-password"
                className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
              />
              <div className="flex gap-2 mt-4">
                <button onClick={() => setResetPasswordConfirm(null)} className="btn-secondary flex-1 !py-2 text-sm">Cancel</button>
                <button
                  onClick={() => handleResetPassword(resetPasswordConfirm)}
                  className="flex-1 px-5 py-2 rounded-xl bg-sky-500 text-white font-medium text-sm hover:bg-sky-600 transition-colors"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showAddUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddUser(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-ink-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <UserPlus2 className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink-900 dark:text-white">Add New User</h3>
                    {!isSuper && (
                      <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">
                        (Only Super Admin can grant admin role)
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowAddUser(false)}
                  className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-500 dark:text-ink-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block mb-1 text-xs text-ink-600 dark:text-ink-300">Username</label>
                  <input
                    type="text"
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-ink-600 dark:text-ink-300">Email</label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-ink-600 dark:text-ink-300">Password</label>
                  <input
                    type="text"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="min 4 characters"
                    className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-xl bg-white dark:bg-ink-800 text-ink-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                  />
                </div>
                <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                  isSuper
                    ? 'bg-ink-50 dark:bg-ink-800/60 border-ink-200/60 dark:border-ink-700 hover:bg-ink-100'
                    : 'bg-ink-50/40 dark:bg-ink-800/30 border-dashed border-ink-200 text-ink-400 dark:text-ink-500 cursor-not-allowed'
                }`}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <div>
                      <p className="text-sm font-medium text-ink-900 dark:text-white">Grant Admin Role</p>
                      <p className="text-[10px] text-ink-500 dark:text-ink-400">
                        {isSuper ? 'User will be able to manage content and users' : 'Super Admin required'}
                      </p>
                    </div>
                  </div>
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${
                    addForm.is_admin ? 'bg-purple-500' : 'bg-ink-300 dark:bg-ink-600'
                  }`}>
                    <button
                      type="button"
                      disabled={!isSuper}
                      onClick={() => isSuper && setAddForm({ ...addForm, is_admin: !addForm.is_admin })}
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${addForm.is_admin ? 'left-6' : 'left-1'}`}
                    />
                  </div>
                </label>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowAddUser(false)} className="btn-secondary flex-1 !py-2 text-sm">Cancel</button>
                <button
                  onClick={handleAddUser}
                  className="flex-1 px-5 py-2 rounded-xl bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors"
                >
                  Create User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-ink-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
