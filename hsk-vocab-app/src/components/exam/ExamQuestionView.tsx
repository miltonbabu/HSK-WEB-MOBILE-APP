import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { ExamQuestion } from '@/types/exam'
import ListeningPlayer from './ListeningPlayer'
import ReorderInput from './ReorderInput'
import PicturePrompt from './PicturePrompt'

interface Props {
  question: ExamQuestion
  index: number
  total: number
  onAnswer: (answer: string) => void
}

export default function ExamQuestionView({ question, index, total, onAnswer }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = (answer: string) => {
    if (submitted) return
    setSubmitted(true)
    onAnswer(answer)
  }

  const submitMcq = () => {
    if (selected === null) return
    submit(selected)
  }

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="card p-5 space-y-4"
    >
      <div className="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
        <span>Question {index + 1} of {total}</span>
        <span className="px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-700 font-medium">
          {question.type.replace('-', ' ')}
        </span>
      </div>

      <p className="text-sm font-semibold text-ink-900 dark:text-white">{question.prompt}</p>

      {/* Listening audio */}
      {question.section === 'listening' && question.audioText && (
        <ListeningPlayer text={question.audioText} />
      )}

      {/* Passage / dialogue transcript (for reading-mcq, listening-mcq review) */}
      {question.passage && question.section === 'reading' && (
        <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/60 border border-ink-100 dark:border-ink-700">
          <p className="chinese-text text-sm leading-relaxed text-ink-800 dark:text-ink-100 whitespace-pre-line">
            {question.passage}
          </p>
        </div>
      )}

      {/* MCQ / T-F / matching */}
      {question.options && question.type !== 'writing-reorder' && question.type !== 'writing-picture' && (
        <div className="space-y-2">
          {question.options.map((opt) => {
            const active = selected === opt
            const showResult = submitted && opt === question.correctAnswer
            const showWrong = submitted && active && opt !== question.correctAnswer
            return (
              <button
                key={opt}
                onClick={() => !submitted && setSelected(opt)}
                disabled={submitted}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  showResult
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : showWrong
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : active
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-800 dark:text-ink-100 hover:border-ink-300 dark:hover:border-ink-600'
                }`}
              >
                <span className={question.section === 'reading' || question.type === 'listening-mcq' ? 'chinese-text' : ''}>
                  {opt}
                </span>
                {showResult && <Check className="w-4 h-4 inline ml-2" />}
              </button>
            )
          })}
          {!submitted && (
            <button onClick={submitMcq} disabled={selected === null} className="btn-primary w-full disabled:opacity-50">
              Submit answer
            </button>
          )}
        </div>
      )}

      {/* Writing: reorder */}
      {question.type === 'writing-reorder' && question.shuffledWords && (
        <ReorderInput
          shuffled={question.shuffledWords}
          correctAnswer={question.correctAnswer}
          onAnswer={submit}
        />
      )}

      {/* Writing: picture */}
      {question.type === 'writing-picture' && (
        <PicturePrompt
          imageUrl={question.imageUrl}
          targetWord={question.targetWord}
          onAnswer={submit}
        />
      )}
    </motion.div>
  )
}
