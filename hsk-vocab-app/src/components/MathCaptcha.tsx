import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, X, ShieldCheck } from 'lucide-react'
 
interface MathCaptchaProps {
  onVerified: (token: string, answer: number) => void
  className?: string
}

function generateProblem(): { problem: string; answer: number } {
  const ops = ['+', '-'] as const
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a = Math.floor(Math.random() * 10) + 1
  let b = Math.floor(Math.random() * 10) + 1
  if (op === '-' && b > a) [a, b] = [b, a]
  const answer = op === '+' ? a + b : a - b
  return { problem: `${a} ${op} ${b}`, answer }
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

export default function MathCaptcha({ onVerified, className = '' }: MathCaptchaProps) {
  const [challenge, setChallenge] = useState<{ problem: string; answer: number } | null>(null)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'ready' | 'wrong' | 'verified'>('ready')

  const newChallenge = useCallback(() => {
    setChallenge(generateProblem())
    setInput('')
    setStatus('ready')
  }, [])

  useEffect(() => {
    newChallenge()
  }, [newChallenge])

  const handleSubmit = () => {
    if (!challenge) return
    const expected = computeAnswer(challenge.problem)
    const userAnswer = parseInt(input, 10)
    if (expected === null || isNaN(userAnswer) || userAnswer !== expected) {
      setStatus('wrong')
      return
    }
    setStatus('verified')
    onVerified(`local-${Date.now()}`, userAnswer)
  }

  if (status === 'verified') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Verified</span>
        </div>
        <button
          onClick={newChallenge}
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
          onClick={newChallenge}
          className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
          title="New problem"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-2">
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
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          className="w-16 px-2 py-1.5 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
          placeholder="?"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input}
          className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Verify Answer
        </button>
      </div>
      {status === 'wrong' && (
        <div className="flex items-center gap-1 text-xs text-red-500">
          <X className="w-3 h-3" />
          Wrong answer. Try again.
        </div>
      )}
    </div>
  )
}
