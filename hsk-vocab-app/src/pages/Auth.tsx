import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores'
import { APP_MODE } from '@/services/supabase'
import { LogIn, UserPlus, Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react'

export default function Auth() {
  const navigate = useNavigate()
  const { login, signup, loginWithGoogle, isLoading } = useAuthStore()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [showWelcome, setShowWelcome] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (isLogin) {
        await login(email, password)
      } else {
        await signup(email, password, username)
      }
      setShowWelcome(true)
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    try {
      await loginWithGoogle()
    } catch (err: any) {
      setError(err.message || 'Google login not available in dev mode')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 30%, #f0fdf4 60%, #fff7ed 100%)',
      }} />
      <div className="dark:hidden">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[600px] h-[600px] top-[-15%] left-[-10%] rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <div className="absolute w-[500px] h-[500px] bottom-[-10%] right-[-10%] rounded-full opacity-35"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.25) 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <div className="absolute w-[400px] h-[400px] top-[40%] left-[30%] rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, rgba(56,178,172,0.2) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative max-w-md w-full"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
            className="inline-flex items-center justify-center w-[80px] h-[80px] rounded-[24px] text-white text-[32px] font-bold mb-4"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
              boxShadow: '0 12px 40px rgba(139,92,246,0.4), 0 0 0 1px rgba(255,255,255,0.2) inset',
            }}
          >
            汉
          </motion.div>
          <h1 className="text-[28px] font-extrabold text-ink-900 dark:text-white tracking-tight">
            XueTong
          </h1>
          <p className="text-ink-400 dark:text-ink-500 text-[13px] font-medium">Your HSK Study Companion</p>
          <p className="text-ink-500 dark:text-ink-400 mt-1.5 text-[15px]">
            {isLogin ? 'Welcome back! Sign in to continue' : 'Create your account to get started'}
          </p>
          <span className="inline-block mt-2.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase backdrop-blur-xl border border-white/20 dark:border-white/10 text-ink-500 dark:text-ink-400"
            style={{ background: 'rgba(255,255,255,0.4)' }}>
            {APP_MODE === 'development' ? 'Dev Mode' : 'Production'}
          </span>
        </motion.div>

        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="rounded-3xl p-[1px]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.4) 100%)',
          }}
        >
          <div className="rounded-3xl p-6 backdrop-blur-2xl"
            style={{ background: 'rgba(255,255,255,0.6)' }}>
            <div className="relative flex mb-6 rounded-2xl p-1"
              style={{ background: 'rgba(0,0,0,0.04)' }}>
              <motion.div
                className="absolute top-1 h-[calc(100%-8px)] rounded-xl shadow-md"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 2px 12px rgba(139,92,246,0.3)',
                }}
                initial={false}
                animate={{
                  left: isLogin ? '4px' : 'calc(50% + 0px)',
                  width: 'calc(50% - 4px)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
              <button
                onClick={() => { setIsLogin(true); setError('') }}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                  isLogin ? 'text-white' : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
              <button
                onClick={() => { setIsLogin(false); setError('') }}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                  !isLogin ? 'text-white' : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Sign Up
              </button>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="p-3.5 rounded-2xl flex items-start gap-2.5"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Username</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <input
                        type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                        className="input-field pl-10" placeholder="Your username…" required
                        autoComplete="username" spellCheck={false}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10" placeholder="you@example.com" required
                    autoComplete="email" spellCheck={false} data-lpignore="true"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10 pr-10" placeholder="••••••••" required minLength={6}
                    autoComplete={isLogin ? 'current-password' : 'new-password'} spellCheck={false} data-lpignore="true"
                  />
                  <button
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <motion.button
                type="submit" disabled={isLoading}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                className="relative w-full py-3 rounded-2xl font-semibold text-white text-sm overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 8px 30px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                <motion.span className="absolute inset-0"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 60%, rgba(255,255,255,0) 100%)' }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-[2.5px] border-white border-t-transparent rounded-full animate-spin" />
                      Please wait…
                    </>
                  ) : isLogin ? (
                    <><LogIn className="w-4 h-4" /> Login</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> Create Account</>
                  )}
                </span>
              </motion.button>
            </form>

            <div className="mt-5">
              {APP_MODE === 'development' && isLogin && (
                <div className="mb-4 p-3 rounded-2xl" style={{
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.15)',
                }}>
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1.5">Test Accounts</p>
                  <div className="space-y-1">
                    {[
                      { email: 'test@test.com', name: 'TestUser', pw: 'test123' },
                      { email: 'lihua@test.com', name: 'LiHua', pw: 'test123' },
                      { email: 'ming@test.com', name: 'Ming', pw: 'test123' },
                      { email: 'miltonbabu9666@gmail.com', name: 'Admin', pw: 'milton9666' },
                    ].map((u) => (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => { setEmail(u.email); setPassword(u.pw) }}
                        className="w-full flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors"
                      >
                        <span className="text-ink-600 dark:text-ink-400">{u.name}</span>
                        <span className="text-ink-400 dark:text-ink-500 font-mono">{u.email}</span>
                      </button>
                    ))}
                    <p className="text-[10px] text-ink-400 dark:text-ink-500 mt-1">Password: test123</p>
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-ink-200/40 dark:border-ink-700/40" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 text-ink-400 dark:text-ink-500 text-xs" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)' }}>
                    Or continue with
                  </span>
                </div>
              </div>

              <motion.button
                onClick={handleGoogleLogin}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-2xl font-medium text-sm transition-all"
                aria-label="Continue with Google"
                style={{
                  background: 'rgba(255,255,255,0.4)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </motion.button>
            </div>
          </div>
        </motion.div>

        <div className="mt-5 text-center">
          <motion.button
            whileHover={{ x: -3 }}
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-purple-500 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Continue as Guest
          </motion.button>
        </div>
      </motion.div>

      {/* Welcome Popup */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="card-glass p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              >
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
              </motion.div>
              <h2 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">
                Welcome!
              </h2>
              <p className="text-ink-500 dark:text-ink-400">
                {isLogin ? 'Successfully signed in' : 'Account created successfully'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}