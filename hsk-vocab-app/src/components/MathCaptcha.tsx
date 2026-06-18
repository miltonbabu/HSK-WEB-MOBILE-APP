import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Check, X, ShieldCheck } from 'lucide-react'

interface MathCaptchaProps {
  onVerified: (token: string, answer: number) => void
  className?: string
}

interface Challenge {
  problem: string
  token: string
}

function computeAnswer(problem: string): number | null {
  const match = problem.match(/^(\d+)\s*([+\-])\s*(\d+)$/)
  if (!match) return null
  const a = parseInt(match[1], 10)
  const b = parseInt(match[3], 10)
  const op = match[2]
  if (op === '+') return a + b
  if (op === '-') return a - b
  return null
}

// Client-side fallback when the /api/captcha/challenge endpoint is
// unavailable (e.g. plain `npm run dev` without `vercel dev`). Generates
// a random addition or subtraction problem locally.
function generateClientSideChallenge(): Challenge {
  const ops = ['+', '-'] as const
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a = Math.floor(Math.random() * 9) + 1
  let b = Math.floor(Math.random() * 9) + 1
  if (op === '-' && b > a) [a, b] = [b, a] // avoid negatives
  return {
    problem: `${a} ${op} ${b}`,
    token: `client-${Date.now()}`,
  }
}

export default function MathCaptcha({ onVerified, className = '' }: MathCaptchaProps) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'wrong' | 'verified'>('loading')
  const [error, setError] = useState('')

  const fetchChallenge = useCallback(async () => {
    setStatus('loading')
    setError('')
    setInput('')
    setChallenge(null)
    try {
      const res = await fetch('/api/captcha/challenge')
      if (!res.ok) throw new Error('Failed to fetch challenge')
      const data = await res.json()
      setChallenge({ problem: data.problem, token: data.token })
      setStatus('ready')
    } catch {
      // Fallback: generate a client-side challenge so the captcha still
      // works in dev mode or if the API is temporarily down.
      setChallenge(generateClientSideChallenge())
      setStatus('ready')
    }
  }, [])

  useEffect(() => {
    fetchChallenge()
  }, [fetchChallenge])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!challenge) return
    const expected = computeAnswer(challenge.problem)
    const userAnswer = parseInt(input, 10)
    if (expected === null || isNaN(userAnswer) || userAnswer !== expected) {
      setStatus('wrong')
      return
    }
    setStatus('verified')
    onVerified(challenge.token, userAnswer)
  }

  if (status === 'loading') {
    return (
      <div className={`flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400 ${className}`}>
        <div className="w-4 h-4 border-2 border-ink-300 border-t-primary-500 rounded-full animate-spin" />
        Loading captcha...
      </div>
    )
  }

  // Verified state — show success, hide the input form
  if (status === 'verified') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Verified</span>
        </div>
        <button
          onClick={fetchChallenge}
          className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors text-xs"
          title="Reset captcha"
        >
          Reset
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Verify you're human:</span>
        <button
          onClick={fetchChallenge}
          className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
          title="New problem"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <span className="text-base font-bold text-ink-900 dark:text-white tabular-nums">
          {challenge?.problem} =
        </span>
        <input
          type="number"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (status === 'wrong') setStatus('ready')
          }}
          className="w-16 px-2 py-1 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
          placeholder="?"
        />
        <button
          type="submit"
          className="px-3 py-1 text-xs font-semibold rounded-lg text-white bg-primary-500 hover:bg-primary-600 transition-colors"
        >
          Verify
        </button>
      </form>
      {status === 'wrong' && (
        <div className="flex items-center gap-1 text-xs text-red-500">
          <X className="w-3 h-3" />
          Wrong answer. Try again.
        </div>
      )}
    </div>
  )
}
