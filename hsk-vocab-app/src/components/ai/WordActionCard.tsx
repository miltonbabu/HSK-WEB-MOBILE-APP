import { Volume2, BookOpen, Layers, Brain } from 'lucide-react'
import { Word } from '@/types'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

interface WordActionCardProps {
  word: Word
  onSpeak: (chinese: string) => void
}

export default function WordActionCard({ word, onSpeak }: WordActionCardProps) {
  const pos = Array.isArray(word.pos) ? word.pos.join(', ') : ''
  const english = word.english.split(';')[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-center gap-1 px-1.5 py-1 rounded-md bg-white dark:bg-white/5 border border-ink-100 dark:border-white/10 hover:border-red-300 dark:hover:border-red-500/50 hover:shadow-sm transition-all"
    >
      <button
        onClick={() => onSpeak(word.chinese)}
        className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        aria-label={`Speak ${word.chinese}`}
      >
        <Volume2 className="w-2.5 h-2.5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="font-bold chinese-text text-[10px] text-ink-900 dark:text-white shrink-0">
            {word.chinese}
          </span>
          <span className="text-[8px] text-ink-400 dark:text-ink-500 italic truncate">
            {word.pinyin}
          </span>
          <span className="px-1 py-0 rounded-[3px] text-[6px] font-bold text-white bg-red-500/90 shrink-0">
            HSK {word.hsk_level}
          </span>
        </div>
        <div className="text-[8px] text-ink-500 dark:text-ink-400 truncate">
          {english}
          {pos ? <span className="text-ink-400 dark:text-ink-500 ml-1">· {pos}</span> : null}
        </div>
      </div>

      <div className="flex items-center gap-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <Link
          to={`/vocabulary?word=${encodeURIComponent(word.chinese)}`}
          className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-ink-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          aria-label="Open in vocabulary"
          title="Open in vocabulary"
        >
          <BookOpen className="w-2.5 h-2.5" />
        </Link>
        <Link
          to={`/learn?word=${encodeURIComponent(word.chinese)}`}
          className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-ink-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          aria-label="Practice with flashcard"
          title="Practice with flashcard"
        >
          <Layers className="w-2.5 h-2.5" />
        </Link>
        <Link
          to="/mode/smart-review"
          className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-ink-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          aria-label="Add to smart review"
          title="Add to smart review"
        >
          <Brain className="w-2.5 h-2.5" />
        </Link>
      </div>
    </motion.div>
  )
}
