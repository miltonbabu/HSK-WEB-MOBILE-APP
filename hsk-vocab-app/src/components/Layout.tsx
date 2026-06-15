import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores'
import { LayoutDashboard, BookOpen, BookMarked, User, LogIn, LogOut, Sparkles, Calendar, Trophy } from 'lucide-react'

const navItems = [
  { path: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/learn', label: 'Learn', Icon: BookOpen },
  { path: '/plan', label: 'Plan', Icon: Calendar },
  { path: '/leaderboard', label: 'Rank', Icon: Trophy },
  { path: '/vocabulary', label: 'Words', Icon: BookMarked },
  { path: '/ai', label: 'AI', Icon: Sparkles },
  { path: '/me', label: 'Me', Icon: User },
]

function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div
        className="orb w-[500px] h-[500px] top-[-10%] left-[-10%]"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)' }}
      />
      <div
        className="orb w-[400px] h-[400px] top-[50%] right-[-5%] animate-float-delayed"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)' }}
      />
      <div
        className="orb w-[350px] h-[350px] bottom-[-5%] left-[20%] animate-float-slow"
        style={{ background: 'radial-gradient(circle, rgba(56,178,172,0.15) 0%, transparent 70%)' }}
      />
      <div
        className="orb w-[300px] h-[300px] top-[30%] left-[40%] animate-float"
        style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)' }}
      />
      <div
        className="orb w-[250px] h-[250px] bottom-[30%] right-[15%] animate-float-delayed"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)' }}
      />
    </div>
  )
}

export default function Layout() {
  const location = useLocation()
  const { user, isGuest, logout } = useAuthStore()

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault()
    logout()
  }

  return (
    <div className="min-h-screen relative" style={{
      background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 30%, #f0fdf4 60%, #fff7ed 100%)',
    }}>
      <div className="dark:hidden">
        <BackgroundOrbs />
      </div>
      <div className="hidden dark:block fixed inset-0 z-0" style={{
        background: 'linear-gradient(135deg, #0f0720 0%, #1a0a2e 30%, #0a1628 60%, #1a0a1a 100%)',
      }} />

      <header className="sticky top-0 z-50 backdrop-blur-2xl border-b border-white/20 dark:border-white/5"
        style={{ background: 'rgba(255,255,255,0.5)' }}
      >
        <div className="dark:hidden absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 100%)',
          backdropFilter: 'blur(24px)',
        }} />
        <div className="hidden dark:block absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(30,30,46,0.8) 0%, rgba(20,20,35,0.5) 100%)',
        }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2.5 group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-9 h-9 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 4px 15px rgba(139,92,246,0.4)',
                }}
              >
                <span className="text-white font-bold text-sm">汉</span>
              </motion.div>
              <span className="text-lg font-bold tracking-tight gradient-text">
                My HSK
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path))
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? 'text-white'
                        : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
                    }`}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                          boxShadow: '0 2px 12px rgba(139,92,246,0.3)',
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <item.Icon className="w-4 h-4 relative z-10" aria-hidden="true" />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-3">
              {isGuest ? (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/auth"
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                      boxShadow: '0 4px 15px rgba(139,92,246,0.35)',
                    }}
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="hidden sm:inline">Login</span>
                  </Link>
                </motion.div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/me"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 hover:bg-white/40 dark:hover:bg-white/10 backdrop-blur-md"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                        boxShadow: '0 2px 10px rgba(139,92,246,0.35)',
                      }}
                    >
                      <User className="w-4 h-4 text-white" />
                    </motion.div>
                    <span className="hidden sm:inline text-sm font-medium text-ink-700 dark:text-ink-200">
                      {user?.username || 'Guest'}
                    </span>
                  </Link>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-ink-600 dark:text-ink-300 hover:bg-white/40 dark:hover:bg-white/10 transition-all duration-300"
                    aria-label="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl border-t border-white/20 dark:border-white/5"
        style={{ background: 'rgba(255,255,255,0.6)', touchAction: 'manipulation' }}
      >
        <div className="dark:hidden absolute inset-0" style={{
          background: 'linear-gradient(0deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 100%)',
          backdropFilter: 'blur(24px)',
        }} />
        <div className="hidden dark:block absolute inset-0" style={{
          background: 'linear-gradient(0deg, rgba(30,30,46,0.9) 0%, rgba(20,20,35,0.5) 100%)',
        }} />
        <div className="relative flex items-center justify-around h-16 pb-safe">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-1 rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(236,72,153,0.2) 100%)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <item.Icon className={`w-5 h-5 relative z-10 transition-colors duration-300 ${
                  isActive ? 'text-purple-500 dark:text-purple-400' : 'text-ink-400 dark:text-ink-500'
                }`}
                style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.4))' } : undefined}
                aria-hidden="true"
                />
                <span className={`relative z-10 text-[10px] font-medium transition-colors duration-300 ${
                  isActive ? 'text-purple-500 dark:text-purple-400' : 'text-ink-400 dark:text-ink-500'
                }`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}