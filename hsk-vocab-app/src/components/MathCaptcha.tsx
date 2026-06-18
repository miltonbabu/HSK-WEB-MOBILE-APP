import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Check, X } from 'lucide-react'

interface MathCaptchaProps {
  onVerified: (token: string, answer: number) => void
  className?: string
}

interface Challenge {
  problem: string
  token: string
}

function computeAnswer(problem: string): number | null {
  const match = problem.match(/^(\d+)\s*([+\-×])\s*(\d+)$/)
  if (!match) return null
  const a = parseInt(match[1], 10)
  const b = parseInt(match[3], 10)
  const op = match[2]
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '×') return a * b
  return null
}

export default function MathCaptcha({ onVerified, className = '' }: MathCaptchaProps) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'wrong'>('loading')
  const [error, setError] = useState('')

  const fetchChallenge = useCallback(async () => {
    setStatus('loading')
    setError('')
    setInput('')
    try {
      const res = await fetch('/api/captcha/challenge')
      if (!res.ok) throw new Error('Failed to fetch challenge')
      const data = await res.json()
      setChallenge({ problem: data.problem, token: data.token })
      setStatus('ready')
    } catch {
      setError('Could not load captcha. Check your connection.')
      setStatus('loading')
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
    onVerified(challenge.token, userAnswer)
  }

  if (status === 'loading' && !challenge) {
    return (
      <div className={`flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400 ${className}`}>
        <div className="w-4 h-4 border-2 border-ink-300 border-t-primary-500 rounded-full animate-spin" />
        Loading captcha...
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-red-500">{error}</span>
        <button onClick={fetchChallenge} className="text-xs text-primary-500 hover:underline">
          Retry
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
          autoFocus
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
      {status === 'ready' && input && (
        <div className="flex items-center gap-1 text-xs text-green-500">
          <Check className="w-3 h-3" />
          Ready to verify
        </div>
      )}
    </div>
  )
}
