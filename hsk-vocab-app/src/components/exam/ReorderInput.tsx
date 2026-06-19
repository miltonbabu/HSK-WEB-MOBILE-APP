import { useState } from 'react'
import { Reorder } from 'framer-motion'
import { Check } from 'lucide-react'

interface Props {
  shuffled: string[]
  correctAnswer: string
  onAnswer: (answer: string) => void
}

export default function ReorderInput({ shuffled, correctAnswer, onAnswer }: Props) {
  const [order, setOrder] = useState<string[]>(shuffled)
  const [submitted, setSubmitted] = useState(false)

  const handleReorder = (newOrder: string[]) => {
    setOrder(newOrder)
  }

  const handleSubmit = () => {
    setSubmitted(true)
    onAnswer(order.join(''))
  }

  const isCorrect = submitted && order.join('') === correctAnswer

  return (
    <div className="space-y-4">
      <Reorder.Group
        axis="x"
        values={order}
        onReorder={handleReorder}
        className="flex flex-wrap justify-center gap-2"
      >
        {order.map((char, index) => (
          <Reorder.Item
            key={char + index}
            value={char}
            className={`w-12 h-12 flex items-center justify-center bg-white dark:bg-ink-700 border-2 rounded-lg font-bold text-2xl cursor-grab active:cursor-grabbing select-none chinese-text ${
              submitted
                ? isCorrect
                  ? 'border-green-500 text-green-500'
                  : 'border-red-500 text-red-500'
                : 'border-ink-300 dark:border-ink-600 text-ink-900 dark:text-white'
            }`}
          >
            {char}
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {!submitted ? (
        <button onClick={handleSubmit} className="btn-primary w-full">
          Submit answer
        </button>
      ) : (
        <div className={`text-center p-3 rounded-xl ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
          <div className="flex items-center justify-center gap-2 font-semibold text-sm">
            <Check className="w-4 h-4" />
            {isCorrect ? 'Correct!' : 'Not quite — see the correct answer below'}
          </div>
          {!isCorrect && (
            <p className="text-xs mt-1 opacity-80">
              Correct: <span className="chinese-text font-semibold">{correctAnswer}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
