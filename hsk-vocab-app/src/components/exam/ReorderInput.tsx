import { useState } from 'react'
import { Reorder } from 'framer-motion'

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
                ? 'border-ink-300 dark:border-ink-600 text-ink-900 dark:text-white opacity-80'
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
        <div className="p-2 rounded-lg bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 text-xs text-center">
          Answer saved · results shown at the end of the exam
        </div>
      )}
    </div>
  )
}
