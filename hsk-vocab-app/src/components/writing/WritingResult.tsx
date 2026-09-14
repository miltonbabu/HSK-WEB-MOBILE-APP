'use client'

import { AlertTriangle, RotateCcw, Search } from 'lucide-react'
import { WritingResultSummary } from '@/types/writing'

interface Props {
  summary: WritingResultSummary
  hasMistakes: boolean
  onReview: () => void
  onPracticeAgain: () => void
  onBackToSetup: () => void
}

export default function WritingResult({
  summary,
  hasMistakes,
  onReview,
  onPracticeAgain,
  onBackToSetup,
}: Props) {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="card p-6 text-center">
        <h2 className="text-xl font-bold text-ink-900 dark:text-white">Writing Practice Complete</h2>
        <p className="mt-4 text-5xl font-extrabold gradient-text">{summary.accuracy}%</p>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">accuracy</p>

        <div className="grid grid-cols-3 gap-3 mt-5 text-center">
          <Stat label="Correct" value={`${summary.correctCount}/${summary.totalQuestions}`} />
          <Stat label="Avg time" value={`${summary.averageTime.toFixed(1)}s`} />
          <Stat label="Duration" value={`${summary.durationSec}s`} />
        </div>
      </div>

      {summary.weakWords.length > 0 && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 mb-2">Weak words</p>
          <div className="flex flex-wrap gap-2">
            {summary.weakWords.map((word) => (
              <span
                key={word}
                className="px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 chinese-text"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary.characterMistakes.length > 0 && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Characters to review
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.characterMistakes.map((char) => (
              <span key={char} className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 chinese-text">
                {char}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {hasMistakes && (
          <button onClick={onReview} className="btn-secondary w-full flex items-center justify-center gap-2">
            <Search className="w-4 h-4" />
            Review mistakes
          </button>
        )}
        <button onClick={onPracticeAgain} className="btn-primary w-full flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Practice again
        </button>
        <button onClick={onBackToSetup} className="w-full text-sm text-ink-500 dark:text-ink-400 hover:text-red-500 py-1">
          Change settings
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-ink-900 dark:text-white tabular-nums">{value}</p>
      <p className="text-xs text-ink-400 dark:text-ink-500">{label}</p>
    </div>
  )
}