import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore, useProgressStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, UserProgress } from '@/types'
import { calculateSM2 } from '@/utils/srs'
import { getToneColor, splitPinyinSyllables } from '@/utils/pinyin'
import { Layers, ChevronLeft, ChevronRight, Heart, BookCheck, Volume2, Shuffle, ArrowRight, Filter } from 'lucide-react'

type FlashcardMode = 'zh-en' | 'en-zh' | 'zh-py'

const MODE_OPTIONS: { id: FlashcardMode; label: string; front: string; back: string }[] = [
  { id: 'zh-en', label: 'ZH → EN', front: 'Chinese', back: 'English' },
  { id: 'en-zh', label: 'EN → ZH', front: 'English', back: 'Chinese' },
  { id: 'zh-py', label: 'ZH → PY', front: 'Chinese', back: 'Pinyin' },
]

export default function FlashcardMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const [words, setWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 })
  const [lovedWords, setLovedWords] = useState<Set<string>>(new Set())
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set())
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [cardMode, setCardMode] = useState<FlashcardMode>('zh-en')
  const [isRandom, setIsRandom] = useState(false)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const originalWords = useRef<Word[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const userId = user?.id || 'guest'
        const allWords = await wordService.getByLevel(selectedLevel)
        const userProgress = await progressService.getUserProgress(userId)
        const progressMap = new Map(userProgress.map((p) => [p.word_id, p]))
        originalWords.current = allWords
        setWords(allWords)
        setProgress(progressMap)
        const learned = new Set<string>()
        const loved = new Set<string>()
        userProgress.forEach((p) => {
          if (p.mastery_level >= 3) learned.add(p.word_id)
          if (p.is_loved) loved.add(p.word_id)
        })
        setLearnedWords(learned)
        setLovedWords(loved)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id, selectedLevel])

  const toggleRandom = () => {
    if (isRandom) {
      setWords([...originalWords.current])
    } else {
      const shuffled = [...words]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      setWords(shuffled)
    }
    setIsRandom(!isRandom)
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  const currentWord = words[currentIndex]
  const currentProgress = currentWord ? progress.get(currentWord.id) : null

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const speak = useCallback((chinese: string, wordId: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(chinese)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.8
    utterance.onend = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)
    setSpeakingId(wordId)
    window.speechSynthesis.speak(utterance)
  }, [])

  const goNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setIsFlipped(false)
    }
  }

  const toggleLove = async () => {
    if (!currentWord) return
    const userId = user?.id || 'guest'
    const isLoved = await progressService.toggleLoved(currentWord.id, userId)
    setLovedWords((prev) => {
      const next = new Set(prev)
      if (isLoved) next.add(currentWord.id)
      else next.delete(currentWord.id)
      return next
    })
    // Update the progress map so the card reflects the new state
    const existing = progress.get(currentWord.id)
    if (existing) {
      setProgress((prev) => {
        const next = new Map(prev)
        next.set(currentWord.id, { ...existing, is_loved: isLoved })
        return next
      })
    }
  }

  const toggleLearned = () => {
    if (!currentWord) return
    setLearnedWords((prev) => {
      const next = new Set(prev)
      if (next.has(currentWord.id)) next.delete(currentWord.id)
      else next.add(currentWord.id)
      return next
    })
  }

  const toggleFavorites = () => {
    const next = !onlyFavorites
    setOnlyFavorites(next)
    if (next) {
      // Filter to only loved words
      const filtered = originalWords.current.filter((w) => lovedWords.has(w.id))
      setWords(filtered)
    } else {
      setWords([...originalWords.current])
    }
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  const handleAnswer = async (quality: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!currentWord) return

    const prevProgress = currentProgress || {
      mastery_level: 0,
      easiness_factor: 2.5,
      interval: 1,
      review_count: 0,
      correct_count: 0,
    }

    const result = calculateSM2(
      quality,
      prevProgress.easiness_factor,
      prevProgress.interval,
      prevProgress.review_count
    )

    const newProgress: Partial<UserProgress> & { word_id: string } = {
      word_id: currentWord.id,
      mastery_level: result.mastery_level,
      easiness_factor: result.easiness_factor,
      interval: result.interval,
      next_review: result.next_review.toISOString(),
      review_count: (prevProgress.review_count || 0) + 1,
      correct_count: quality >= 3 ? (prevProgress.correct_count || 0) + 1 : prevProgress.correct_count,
    }

    await progressService.updateProgress(newProgress, user?.id || 'guest')

    const newProgressMap = new Map(progress)
    newProgressMap.set(currentWord.id, {
      ...currentProgress,
      ...newProgress,
      id: currentProgress?.id || crypto.randomUUID(),
      user_id: user?.id || 'guest',
      last_reviewed: new Date().toISOString(),
    } as UserProgress)
    setProgress(newProgressMap)

    if (result.mastery_level >= 3) {
      setLearnedWords((prev) => new Set(prev).add(currentWord.id))
    }

    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: quality >= 3 ? prev.correct + 1 : prev.correct,
    }))

    setIsFlipped(false)
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const answerButtons = [
    { quality: 1 as const, label: 'Again', sublabel: '< 1 min', bg: '#ef4444', shadow: 'rgba(239,68,68,0.3)' },
    { quality: 2 as const, label: 'Hard', sublabel: '6 min', bg: '#f59e0b', shadow: 'rgba(245,158,11,0.3)' },
    { quality: 3 as const, label: 'Good', sublabel: '1 day', bg: '#10b981', shadow: 'rgba(16,185,129,0.3)' },
    { quality: 4 as const, label: 'Easy', sublabel: '3 days', bg: '#8b5cf6', shadow: 'rgba(139,92,246,0.3)' },
  ]

  const renderFront = () => {
    if (!currentWord) return null
    switch (cardMode) {
      case 'zh-en':
        return (
          <>
            <span className="text-5xl sm:text-6xl font-bold text-ink-900 dark:text-white tracking-wide chinese-text">
              {currentWord.chinese}
            </span>
            <p className="mt-4 text-ink-400 dark:text-ink-500 text-sm">Tap to reveal English</p>
          </>
        )
      case 'en-zh':
        return (
          <>
            <span className="text-2xl sm:text-3xl font-semibold text-ink-900 dark:text-white text-center px-6">
              {currentWord.english}
            </span>
            <p className="mt-4 text-ink-400 dark:text-ink-500 text-sm">Tap to reveal Chinese</p>
          </>
        )
      case 'zh-py':
        return (
          <>
            <span className="text-5xl sm:text-6xl font-bold text-ink-900 dark:text-white tracking-wide chinese-text">
              {currentWord.chinese}
            </span>
            <p className="mt-4 text-ink-400 dark:text-ink-500 text-sm">Tap to reveal Pinyin</p>
          </>
        )
    }
  }

  const renderBack = () => {
    if (!currentWord) return null
    switch (cardMode) {
      case 'zh-en':
        return (
          <>
            <div className="text-3xl font-semibold mb-4">
              {splitPinyinSyllables(currentWord.pinyin).map(({ syllable, tone }, i) => (
                <span key={i} className={getToneColor(tone)}>
                  {syllable}{i < currentWord.pinyin.split(' ').length - 1 ? ' ' : ''}
                </span>
              ))}
            </div>
            <span className="text-xl font-medium text-ink-800 dark:text-ink-200">{currentWord.english}</span>
            <span className="mt-2 text-xs text-ink-400 dark:text-ink-500">
              {Array.isArray(currentWord.pos) ? currentWord.pos.join(' · ') : currentWord.pos}
            </span>
          </>
        )
      case 'en-zh':
        return (
          <>
            <span className="text-5xl sm:text-6xl font-bold text-ink-900 dark:text-white tracking-wide chinese-text">
              {currentWord.chinese}
            </span>
            <div className="text-2xl font-semibold mt-4">
              {splitPinyinSyllables(currentWord.pinyin).map(({ syllable, tone }, i) => (
                <span key={i} className={getToneColor(tone)}>
                  {syllable}{i < currentWord.pinyin.split(' ').length - 1 ? ' ' : ''}
                </span>
              ))}
            </div>
            <span className="mt-2 text-xs text-ink-400 dark:text-ink-500">
              {Array.isArray(currentWord.pos) ? currentWord.pos.join(' · ') : currentWord.pos}
            </span>
          </>
        )
      case 'zh-py':
        return (
          <>
            <div className="text-4xl font-semibold mb-3">
              {splitPinyinSyllables(currentWord.pinyin).map(({ syllable, tone }, i) => (
                <span key={i} className={getToneColor(tone)}>
                  {syllable}{i < currentWord.pinyin.split(' ').length - 1 ? ' ' : ''}
                </span>
              ))}
            </div>
            <span className="text-lg font-medium text-ink-800 dark:text-ink-200">{currentWord.english}</span>
            <span className="mt-2 text-xs text-ink-400 dark:text-ink-500">
              {Array.isArray(currentWord.pos) ? currentWord.pos.join(' · ') : currentWord.pos}
            </span>
          </>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-red-500 border-t-transparent" />
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-12">
        <Layers className="w-16 h-16 text-ink-400 dark:text-ink-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-ink-900 dark:text-white mt-4">No Words Available</h2>
        <p className="text-ink-500 dark:text-ink-400 mt-2">
          No words found for HSK {selectedLevel}. Try selecting a different level.
        </p>
      </div>
    )
  }

  const isLoved = currentWord ? lovedWords.has(currentWord.id) : false
  const isLearned = currentWord ? learnedWords.has(currentWord.id) : false

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Compact meta row — no duplicate top nav bar, the global header
          already shows the page context. We just keep a tiny inline summary. */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-ink-500 dark:text-ink-400">
          HSK {selectedLevel} • Card {currentIndex + 1}/{words.length}
        </p>
        <div className="text-right">
          <p className="text-[10px] text-ink-500 dark:text-ink-400">Accuracy</p>
          <p className="text-sm font-semibold gradient-text">
            {sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => { setCardMode(opt.id); setIsFlipped(false) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              cardMode === opt.id
                ? 'pill-active'
                : 'pill-inactive'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="w-px h-5 bg-ink-200 dark:bg-ink-700 mx-1" />
        <button
          onClick={toggleRandom}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isRandom
              ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
              : 'pill-inactive'
          }`}
        >
          {isRandom ? <Shuffle className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          Random
        </button>
        <button
          onClick={toggleFavorites}
          disabled={lovedWords.size === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            onlyFavorites
              ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
              : lovedWords.size === 0
              ? 'pill-inactive opacity-40 cursor-not-allowed'
              : 'pill-inactive'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          {onlyFavorites ? `${words.length} loved` : `Favorites (${lovedWords.size})`}
        </button>
      </div>

      <div className="h-2 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden backdrop-blur">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)' }}
          initial={{ width: `${((currentIndex) / words.length) * 100}%` }}
          animate={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentWord.id}-${cardMode}`}
          initial={{ opacity: 0, x: 50, rotateY: -10 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          exit={{ opacity: 0, x: -50, rotateY: 10 }}
          transition={{ duration: 0.3 }}
          className="relative h-72 sm:h-80 cursor-pointer"
          onClick={handleFlip}
          style={{ perspective: '1000px' }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              className="absolute inset-0 card flex flex-col items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              {renderFront()}
            </div>

            <div
              className="absolute inset-0 card flex flex-col items-center justify-center"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              {renderBack()}
              <button
                onClick={(e) => { e.stopPropagation(); speak(currentWord.chinese, currentWord.id) }}
                className={`mt-3 p-2 rounded-lg transition-colors ${
                  speakingId === currentWord.id
                    ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'text-ink-400 dark:text-ink-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
              >
                <Volume2 className={`w-5 h-5 ${speakingId === currentWord.id ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className={`p-2.5 rounded-xl transition-all ${
            currentIndex === 0
              ? 'text-ink-300 dark:text-ink-600 cursor-not-allowed'
              : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/30 dark:hover:bg-white/10 active:scale-95'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLove}
            className={`p-2.5 rounded-xl transition-all ${
              isLoved
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-ink-400 dark:text-ink-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95'
            }`}
          >
            <Heart className={`w-5 h-5 ${isLoved ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={toggleLearned}
            className={`p-2.5 rounded-xl transition-all ${
              isLearned
                ? 'text-green-500 bg-green-50 dark:bg-green-900/20'
                : 'text-ink-400 dark:text-ink-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 active:scale-95'
            }`}
          >
            <BookCheck className={`w-5 h-5 ${isLearned ? 'fill-current' : ''}`} />
          </button>
        </div>

        <button
          onClick={goNext}
          disabled={currentIndex === words.length - 1}
          className={`p-2.5 rounded-xl transition-all ${
            currentIndex === words.length - 1
              ? 'text-ink-300 dark:text-ink-600 cursor-not-allowed'
              : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/30 dark:hover:bg-white/10 active:scale-95'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="grid grid-cols-4 gap-2"
          >
            {answerButtons.map((btn) => (
              <motion.button
                key={btn.quality}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer(btn.quality)}
                className="py-3 px-2 rounded-2xl font-semibold text-sm text-white transition-all flex flex-col items-center"
                style={{
                  background: `linear-gradient(135deg, ${btn.bg} 0%, ${btn.bg}cc 100%)`,
                  boxShadow: `0 4px 15px ${btn.shadow}`,
                }}
              >
                <span>{btn.label}</span>
                <span className="text-[10px] opacity-70 mt-0.5">{btn.sublabel}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-center gap-3">
        {[0, 1, 2, 3, 4, 5].map((level) => {
          const count = Array.from(progress.values()).filter((p) => p.mastery_level === level).length
          const colors = ['#c3c4cd', '#ef4444', '#f59e0b', '#eab308', '#10b981', '#8b5cf6']
          return (
            <div key={level} className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[level], boxShadow: `0 0 6px ${colors[level]}80` }} />
              <span className="text-[10px] text-ink-400 dark:text-ink-500">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
