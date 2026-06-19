import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Image as ImageIcon } from 'lucide-react'
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
  const [imgError, setImgError] = useState(false)

  const submit = (answer: string) => {
    if (submitted) return
    setSubmitted(true)
    onAnswer(answer)
  }

  const submitMcq = () => {
    if (selected === null) return
    submit(selected)
  }

  const isListeningMCQ = question.type === 'listening-mcq' && !!question.imageOptions?.length
  const isListeningTF = question.type === 'listening-tf'

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

      {/* Listening-TF: scenario image + English statement */}
      {isListeningTF && (
        <div className="space-y-3">
          {question.imageUrl && !imgError ? (
            <img
              src={question.imageUrl}
              alt="Listening scenario"
              className="rounded-xl w-full max-w-sm mx-auto max-h-48 object-cover border border-ink-200 dark:border-ink-700"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full max-w-sm mx-auto h-32 rounded-xl bg-ink-100 dark:bg-ink-700 flex items-center justify-center text-ink-400">
              <ImageIcon className="w-6 h-6" />
            </div>
          )}
          {question.statement && (
            <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/60 border border-ink-100 dark:border-ink-700">
              <p className="text-sm text-ink-800 dark:text-ink-100 italic">
                "{question.statement}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Listening-MCQ: dialogue transcript + 3 picture choices */}
      {isListeningMCQ && question.imageOptions && (
        <div className="space-y-3">
          {question.passage && (
            <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/60 border border-ink-100 dark:border-ink-700">
              <p className="chinese-text text-sm leading-relaxed text-ink-800 dark:text-ink-100 whitespace-pre-line">
                {question.passage}
              </p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {question.imageOptions.map((opt, idx) => {
              const label = String.fromCharCode(65 + idx)
              const isSelected = selected === label
              const showCorrect = submitted && opt.correct
              const showWrong = submitted && isSelected && !opt.correct
              return (
                <button
                  key={idx}
                  onClick={() => !submitted && setSelected(label)}
                  disabled={submitted}
                  className={`relative rounded-xl border-2 overflow-hidden transition-all ${
                    showCorrect
                      ? 'border-green-500 ring-2 ring-green-400'
                      : showWrong
                      ? 'border-red-500'
                      : isSelected
                      ? 'border-red-500 ring-2 ring-red-300'
                      : 'border-ink-200 dark:border-ink-700 hover:border-ink-400'
                  }`}
                >
                  <img
                    src={opt.url}
                    alt={`Option ${label}`}
                    className="w-full h-24 object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                    loading="lazy"
                  />
                  <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white/90 dark:bg-ink-900/90 text-ink-900 dark:text-white text-xs font-bold flex items-center justify-center">
                    {label}
                  </div>
                  {showCorrect && (
                    <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Non-listening MCQ options (reading-mcq, reading-cloze, etc.) */}
      {question.options && !isListeningMCQ && !isListeningTF && question.type !== 'writing-reorder' && question.type !== 'writing-picture' && (
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
        </div>
      )}

      {/* Listening-TF: True/False buttons */}
      {isListeningTF && !submitted && (
        <div className="space-y-2">
          <button
            onClick={() => setSelected('True')}
            className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              selected === 'True'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-800 dark:text-ink-100 hover:border-ink-300'
            }`}
          >
            True
          </button>
          <button
            onClick={() => setSelected('False')}
            className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              selected === 'False'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-800 dark:text-ink-100 hover:border-ink-300'
            }`}
          >
            False
          </button>
        </div>
      )}

      {/* Listening-TF: after submit, show result */}
      {isListeningTF && submitted && (
        <div className={`p-3 rounded-xl text-sm font-semibold ${
          selected === question.correctAnswer
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {selected === question.correctAnswer ? '✓ Correct!' : `✗ Incorrect. The answer is ${question.correctAnswer}.`}
        </div>
      )}

      {/* Submit button for MCQ */}
      {!submitted && !isListeningTF && question.options && question.type !== 'writing-reorder' && question.type !== 'writing-picture' && (
        <button onClick={submitMcq} disabled={selected === null} className="btn-primary w-full disabled:opacity-50">
          Submit answer
        </button>
      )}

      {/* Submit button for T/F */}
      {!submitted && isListeningTF && (
        <button
          onClick={submitMcq}
          disabled={selected === null}
          className="btn-primary w-full disabled:opacity-50"
        >
          Submit answer
        </button>
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
