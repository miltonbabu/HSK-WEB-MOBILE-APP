import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Flag, Headphones, BookOpen, PenTool, SkipForward, Pause, Play } from 'lucide-react'
import { ExamSection } from '@/types/exam'
import ExamTimer from './ExamTimer'
import ExamQuestionView from './ExamQuestionView'

interface Props {
  section: ExamSection
  sectionIndex: number
  totalSections: number
  answers: Map<string, string>
  onAnswer: (questionId: string, answer: string) => void
  onFinishSection: () => void
  allowPause?: boolean
}

/** Sentinel value recorded when a user explicitly skips a question. */
export const SKIP_SENTINEL = '__SKIPPED__'

/** A question counts as "answered" only if it has a real (non-skip) value. */
function isAnswered(answers: Map<string, string>, qId: string): boolean {
  const a = answers.get(qId)
  return !!a && a !== SKIP_SENTINEL
}

const SECTION_ICONS = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenTool,
} as const

export default function ExamSectionRunner({
  section,
  sectionIndex,
  totalSections,
  answers,
  onAnswer,
  onFinishSection,
  allowPause = false,
}: Props) {
  const [current, setCurrent] = useState(0)
  const [showPalette, setShowPalette] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const total = section.questions.length
  const question = section.questions[current]
  const Icon = SECTION_ICONS[section.id]
  const answeredCount = section.questions.filter((q) => isAnswered(answers, q.id)).length
  const skippedCount = section.questions.filter((q) => answers.get(q.id) === SKIP_SENTINEL).length

  const goNext = () => {
    if (current < total - 1) setCurrent((c) => c + 1)
  }
  const goPrev = () => {
    if (current > 0) setCurrent((c) => c - 1)
  }

  const handleSkip = () => {
    // Skip = move on without answering. The sentinel is recorded so the
    // palette/grading can distinguish "skipped" from "never visited".
    onAnswer(question.id, SKIP_SENTINEL)
    if (current < total - 1) setCurrent((c) => c + 1)
  }

  const handleTimeUp = () => {
    // Signal ExamQuestionView to auto-submit its current selection (Fix 3),
    // then finish the section after the state update flushes.
    setTimeUp(true)
    setTimeout(() => onFinishSection(), 100)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Section header */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-ink-900 dark:text-white text-sm">
                {section.name} <span className="chinese-text font-normal">· {section.nameCn}</span>
              </h2>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">
              Section {sectionIndex + 1} of {totalSections} · {answeredCount}/{total} answered · {skippedCount} skipped
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allowPause && (
              <button
                onClick={() => setIsPaused((p) => !p)}
                className="p-2 rounded-lg bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            )}
            <ExamTimer durationSec={section.durationSec} onExpire={handleTimeUp} paused={isPaused} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-300"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Paused overlay */}
      {isPaused && (
        <div className="card p-8 text-center space-y-3">
          <Pause className="w-10 h-10 text-ink-400 mx-auto" />
          <h3 className="text-lg font-bold text-ink-900 dark:text-white">Exam paused</h3>
          <p className="text-sm text-ink-500 dark:text-ink-400">Take a break. Click resume when you're ready to continue.</p>
          <button onClick={() => setIsPaused(false)} className="btn-primary inline-flex items-center gap-2">
            <Play className="w-4 h-4" />
            Resume exam
          </button>
        </div>
      )}

      {/* Current question — hidden while paused */}
      {!isPaused && (
        <ExamQuestionView
          key={question.id}
          question={question}
          index={current}
          total={total}
          onAnswer={(ans) => onAnswer(question.id, ans)}
          timeUp={timeUp}
        />
      )}

      {/* Navigation — disabled while paused */}
      {!isPaused && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={goPrev}
            disabled={current === 0}
            className="btn-secondary px-4 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowPalette((s) => !s)}
            className="text-xs font-semibold text-ink-600 dark:text-ink-300 px-3 py-2 rounded-lg bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700"
          >
            {current + 1} / {total}
          </button>

          <button
            onClick={handleSkip}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200 text-sm font-semibold"
            title="Skip this question"
          >
            <SkipForward className="w-4 h-4" />
            <span className="hidden sm:inline">Skip</span>
          </button>

          {current < total - 1 ? (
            <button onClick={goNext} className="btn-primary px-4">
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onFinishSection}
              className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm flex items-center gap-1.5"
            >
              <Flag className="w-4 h-4" />
              Finish section
            </button>
          )}
        </div>
      )}

      {/* Question palette */}
      {showPalette && !isPaused && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card p-3"
        >
          <p className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-2">Jump to question</p>
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
            {section.questions.map((q, i) => {
              const answered = isAnswered(answers, q.id)
              const wasSkipped = answers.get(q.id) === SKIP_SENTINEL
              const isCurrent = i === current
              return (
                <button
                  key={q.id}
                  onClick={() => { setCurrent(i); setShowPalette(false) }}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-red-500 text-white ring-2 ring-red-300'
                      : answered
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : wasSkipped
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                      : 'bg-ink-100 dark:bg-ink-700 text-ink-500 dark:text-ink-400'
                  }`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
