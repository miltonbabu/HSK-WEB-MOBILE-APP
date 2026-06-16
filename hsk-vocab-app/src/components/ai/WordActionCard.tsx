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
      className="group flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-ink-100 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/50 hover:shadow-sm transition-all"
    >
      <button
        onClick={() => onSpeak(word.chinese)}
        className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
        aria-label={`Speak ${word.chinese}`}
      >
        <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
          <span className="font-bold chinese-text text-sm sm:text-base text-ink-900 dark:text-white shrink-0">
            {word.chinese}
          </span>
          <span className="text-[10px] sm:text-xs text-ink-400 dark:text-ink-500 italic truncate">
            {word.pinyin}
          </span>
          <span className="px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold text-white bg-purple-500/90 shrink-0">
            HSK {word.hsk_level}
          </span>
        </div>
        <div className="text-[10px] sm:text-xs text-ink-500 dark:text-ink-400 truncate">
          {english}
          {pos ? <span className="text-ink-400 dark:text-ink-500 ml-1">· {pos}</span> : null}
        </div>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
        <Link
          to={`/vocabulary?word=${encodeURIComponent(word.chinese)}`}
          className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-ink-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
          aria-label="Open in vocabulary"
          title="Open in vocabulary"
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Link>
        <Link
          to={`/learn?word=${encodeURIComponent(word.chinese)}`}
          className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-ink-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
          aria-label="Practice with flashcard"
          title="Practice with flashcard"
        >
          <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Link>
        <Link
          to="/mode/smart-review"
          className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-ink-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
          aria-label="Add to smart review"
          title="Add to smart review"
        >
          <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Link>
      </div>
    </motion.div>
  )
}
