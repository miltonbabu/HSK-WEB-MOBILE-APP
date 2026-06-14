import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAdminStore } from '@/stores'
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { login, isLoading } = useAdminStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      navigate('/admin')
    } catch (err: any) {
      setError(err.message || 'Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-ink-100 via-ink-50 to-white dark:from-ink-950 dark:via-ink-900 dark:to-ink-950" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative max-w-sm w-full"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="inline-flex items-center justify-center w-[64px] h-[64px] rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <Shield className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">Admin Panel</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-1 text-sm">
            Sign in to manage users
          </p>
        </div>

        <div className="rounded-2xl border border-ink-200/50 dark:border-ink-700/50 bg-white dark:bg-ink-800 p-6 shadow-sm">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4"
            >
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Email"
                  autoComplete="off"
                  data-lpignore="true"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  data-lpignore="true"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" />
                Sign In as Admin
              </span>
            </motion.button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-brand-500 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to App
          </button>
        </div>
      </motion.div>
    </div>
  )
}