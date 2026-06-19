import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, RotateCcw, Home, ChevronDown, Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ExamResult } from '@/types/exam'
import ListeningPlayer from './ListeningPlayer'

/** Sentinel used by ExamSectionRunner for skipped questions. */
const SKIP_SENTINEL = '__SKIPPED__'

interface Props {
  result: ExamResult
  onRetake: () => void
}

export default function ExamResultView({ result, onRetake }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const passed = result.passed
  const pct = Math.round((result.correctCount / Math.max(result.totalQuestions, 1)) * 100)

  const sections = [
    { id: 'listening' as const, name: 'Listening', nameCn: '听力' },
    { id: 'reading' as const, name: 'Reading', nameCn: '阅读' },
    { id: 'writing' as const, name: 'Writing', nameCn: '书写' },
  ]

  const mins = Math.floor(result.durationSec / 60)
  const secs = result.durationSec % 60

  /** Format the user's answer for display, handling the skip sentinel. */
  const formatUserAnswer = (answer: string): string => {
    if (!answer || answer === SKIP_SENTINEL) return '(skipped)'
    return answer
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Score hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`card p-6 text-center ${passed ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}
      >
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-3 ${passed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
          <Trophy className={`w-10 h-10 ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
        </div>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white">
          {result.score}<span className="text-lg text-ink-400">/300</span>
        </h1>
        <div className={`inline-block mt-2 px-4 py-1 rounded-full text-sm font-bold ${passed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {passed ? 'PASSED' : 'NOT PASSED'}
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-3">
          {result.correctCount} of {result.totalQuestions} correct ({pct}%) · {mins}m {secs}s
        </p>
      </motion.div>

      {/* Section breakdown */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-4">Section breakdown</h2>
        <div className="space-y-4">
          {sections.map((s) => {
            const r = result.sectionResults[s.id]
            if (!r || r.total === 0) return null
            const sPct = Math.round((r.correct / r.total) * 100)
            return (
              <div key={s.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-ink-700 dark:text-ink-200">
                    {s.name} <span className="chinese-text font-normal text-ink-400">· {s.nameCn}</span>
                  </span>
                  <span className="text-ink-500 dark:text-ink-400">{r.correct}/{r.total} ({sPct}%)</span>
                </div>
                <div className="h-2 bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${sPct >= 60 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${sPct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Question review */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-white mb-3">Review answers</h2>
        <div className="space-y-2">
          {result.questionReviews.map((review, i) => {
            const sectionName = sections.find((s) => s.id === review.question.section)?.name || ''
            const q = review.question
            const displayAnswer = formatUserAnswer(review.userAnswer)
            const isChinese = q.section === 'reading' || q.type === 'listening-mcq' || q.section === 'writing'
            return (
              <div key={review.question.id} className="border border-ink-100 dark:border-ink-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === review.question.id ? null : review.question.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800/50"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${review.correct ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {review.correct ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" /> : <X className="w-4 h-4 text-red-600 dark:text-red-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink-700 dark:text-ink-200">
                      Q{i + 1} · {sectionName}
                    </p>
                    <p className="text-xs text-ink-500 dark:text-ink-400 truncate">
                      {displayAnswer}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-ink-400 transition-transform ${expandedSection === review.question.id ? 'rotate-180' : ''}`} />
                </button>
                {expandedSection === review.question.id && (
                  <div className="px-3 pb-3 pt-1 text-xs space-y-2 border-t border-ink-100 dark:border-ink-700">
                    <p className="text-ink-600 dark:text-ink-300">
                      <span className="font-semibold">Prompt:</span> {q.prompt}
                    </p>

                    {/* Listening: audio replay + transcript */}
                    {q.audioText && (
                      <div className="space-y-1">
                        <p className="text-ink-500 dark:text-ink-400 font-semibold">Audio:</p>
                        <ListeningPlayer text={q.audioText} autoPlay={false} />
                        <p className="chinese-text text-ink-700 dark:text-ink-200 pl-2">
                          {q.audioText}
                        </p>
                      </div>
                    )}

                    {/* Listening-TF: statement + scenario image */}
                    {q.statement && (
                      <p className="text-ink-600 dark:text-ink-300 italic">
                        <span className="font-semibold not-italic">Statement:</span> "{q.statement}"
                      </p>
                    )}

                    {/* Single image (listening-tf, writing-picture) */}
                    {q.imageUrl && (
                      <div className="space-y-1">
                        <p className="text-ink-500 dark:text-ink-400 font-semibold">Image:</p>
                        <img
                          src={q.imageUrl}
                          alt="Question image"
                          className="rounded-lg max-w-xs max-h-40 object-cover border border-ink-200 dark:border-ink-700"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Listening-MCQ: 3 picture options, highlight correct */}
                    {q.imageOptions && q.imageOptions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-ink-500 dark:text-ink-400 font-semibold">Picture options:</p>
                        <div className="grid grid-cols-3 gap-2">
                          {q.imageOptions.map((opt, idx) => (
                            <div
                              key={idx}
                              className={`relative rounded-lg overflow-hidden border-2 ${opt.correct ? 'border-green-500' : 'border-ink-200 dark:border-ink-700'}`}
                            >
                              <img
                                src={opt.url}
                                alt={`Option ${String.fromCharCode(65 + idx)}`}
                                className="w-full h-20 object-cover"
                                loading="lazy"
                              />
                              <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white/90 dark:bg-ink-900/90 text-ink-900 dark:text-white text-[10px] font-bold flex items-center justify-center">
                                {String.fromCharCode(65 + idx)}
                              </div>
                              {opt.correct && (
                                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Passage / dialogue transcript */}
                    {q.passage && (
                      <p className="chinese-text text-ink-700 dark:text-ink-200">
                        <span className="font-semibold not-italic">Passage:</span> {q.passage}
                      </p>
                    )}

                    <p className="text-green-700 dark:text-green-400">
                      <span className="font-semibold">Correct:</span>{' '}
                      <span className={isChinese ? 'chinese-text' : ''}>
                        {q.correctAnswer}
                      </span>
                    </p>
                    <p className="text-ink-600 dark:text-ink-300">
                      <span className="font-semibold">Your answer:</span>{' '}
                      <span className={isChinese && displayAnswer !== '(skipped)' ? 'chinese-text' : ''}>
                        {displayAnswer}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onRetake} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Retake exam
        </button>
        <Link to="/learn" className="btn-secondary flex-1 flex items-center justify-center gap-2">
          <Home className="w-4 h-4" />
          Back to Learn
        </Link>
      </div>
    </div>
  )
}
