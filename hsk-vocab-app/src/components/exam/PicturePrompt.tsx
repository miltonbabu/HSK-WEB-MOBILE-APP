import { useState } from 'react'
import { Image as ImageIcon, Send } from 'lucide-react'

interface Props {
  imageUrl?: string
  targetWord?: string
  onAnswer: (answer: string) => void
}

export default function PicturePrompt({ imageUrl, targetWord, onAnswer }: Props) {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [imgError, setImgError] = useState(false)

  const submit = () => {
    if (!value.trim()) return
    setSubmitted(true)
    onAnswer(value.trim())
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt="Picture prompt"
            className="rounded-xl max-w-full max-h-64 border border-ink-200 dark:border-ink-700"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full max-w-sm h-48 rounded-xl bg-ink-100 dark:bg-ink-700 flex flex-col items-center justify-center text-ink-400 dark:text-ink-500">
            <ImageIcon className="w-8 h-8 mb-2" />
            <span className="text-xs">Picture unavailable — write a sentence about the scene using the target word.</span>
          </div>
        )}
        {targetWord && (
          <div className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-semibold">
            Use this word: <span className="chinese-text text-base">{targetWord}</span>
          </div>
        )}
      </div>

      {!submitted ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Type your sentence in Chinese..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            autoFocus
          />
          <button onClick={submit} disabled={!value.trim()} className="btn-primary px-4">
            <Send className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800 text-sm">
          <span className="text-ink-500 dark:text-ink-400">Your answer: </span>
          <span className="chinese-text font-semibold text-ink-900 dark:text-white">{value}</span>
        </div>
      )}
    </div>
  )
}
