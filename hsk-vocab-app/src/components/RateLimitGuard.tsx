import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores'
import { rateLimitService, GUEST_MODE_LIMIT, GUEST_DAILY_MINUTES } from '@/services/rate-limit.service'
import { Lock, Clock, Sparkles, LogIn } from 'lucide-react'

interface Props {
  modeId: string
  modeName?: string
  children: React.ReactNode
}

export default function RateLimitGuard({ modeId, modeName, children }: Props) {
  const { user, isGuest } = useAuthStore()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [reason, setReason] = useState<'mode_limit' | 'time_limit' | null>(null)
  const [stats, setStats] = useState<{
    totalSecondsToday: number
  } | null>(null)
  const sessionIdRef = useRef<number>(0)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const check = await rateLimitService.checkLimit(user.id, modeId, isGuest)
        if (cancelled) return
        setAllowed(check.allowed)
        setReason(check.reason ?? null)
        setStats({ totalSecondsToday: check.stats.totalSecondsToday })

        if (check.allowed) {
          sessionIdRef.current = await rateLimitService.startSession(user.id, modeId)
        }
      } catch (e) {
        console.error('RateLimitGuard check failed:', e)
        if (!cancelled) {
          // Fail open: let the user into the mode rather than blocking them
          // on a transient DB error.
          setAllowed(true)
        }
      }
    })()

    return () => {
      cancelled = true
      if (sessionIdRef.current) {
        void rateLimitService.endSession(sessionIdRef.current)
        sessionIdRef.current = 0
      }
    }
  }, [user?.id, modeId, isGuest])

  // Loading state — show children dimmed instead of a hard spinner. This
  // prevents a blank flash on first load while the rate-limit check is
  // still resolving.
  if (allowed === null) {
    return (
      <div className="relative opacity-50 pointer-events-none" aria-busy="true">
        {children}
      </div>
    )
  }

  // Registered users always see the mode
  if (!isGuest) return <>{children}</>

  // Blocked guests
  if (!allowed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full card-glass rounded-3xl p-8 text-center"
        >
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c41e1a 0%, #daa520 100%)' }}
          >
            {reason === 'mode_limit' ? (
              <Lock className="w-8 h-8 text-white" />
            ) : (
              <Clock className="w-8 h-8 text-white" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {reason === 'mode_limit' ? 'Daily limit reached' : 'Time limit reached'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            {reason === 'mode_limit'
              ? `You've used ${modeName || 'this mode'} ${GUEST_MODE_LIMIT} times today as a guest.`
              : `You've used ${GUEST_DAILY_MINUTES} minutes of study time today.`}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Sign up free to unlock unlimited {modeName || 'mode'} access and full study time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/auth?mode=signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #c41e1a 0%, #daa520 100%)' }}
            >
              <Sparkles className="w-4 h-4" /> Sign Up Free
            </Link>
            <Link
              to="/auth?mode=login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
            >
              <LogIn className="w-4 h-4" /> Log In
            </Link>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
            Limits reset at midnight.{' '}
            {Math.floor((stats?.totalSecondsToday ?? 0) / 60)} / {GUEST_DAILY_MINUTES} min used today.
          </p>
        </motion.div>
      </div>
    )
  }

  return <>{children}</>
}
