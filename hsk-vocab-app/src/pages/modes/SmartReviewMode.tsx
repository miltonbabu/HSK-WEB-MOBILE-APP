import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore, useProgressStore } from '@/stores'
import { wordService, progressService, sessionService } from '@/services/sqlite-api'
import { updateWordProgress, recordStudySession } from '@/utils/study-helpers'
import { generateSmartReview, SmartReviewSession } from '@/services/ai-features'
import { Brain, Check, X, RotateCcw, Sparkles, Star, ArrowRight } from 'lucide-react'
import SEO from '@/components/SEO/Helmet'
import { PAGE_SEO } from '@/utils/seo'

export default function SmartReviewMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<'loading' | 'setup' | 'review' | 'results'>('loading')
  const [session, setSession] = useState<SmartReviewSession | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [reviewedCount, setReviewedCount] = useState(0)

  const sessionStartRef = useRef(Date.now())

  useEffect(() => {
    async function loadData() {
      try {
        const allWords = await wordService.getAll()
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')

        // Generate smart review session
        const sessions = await sessionService.getStats(user?.id || 'guest', 30)
        const reviewSession = await generateSmartReview(
          userProgress,
          allWords,
          sessions as any,
          selectedLevel,
        )
        setSession(reviewSession)
        setPhase('setup')
      } catch (error) {
        console.error('Failed to load smart review:', error)
        setPhase('setup')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id, selectedLevel])

  const startReview = () => {
    if (!session || session.words.length === 0) return
    setCurrentIndex(0)
    setShowAnswer(false)
    setCorrectCount(0)
    setReviewedCount(0)
    sessionStartRef.current = Date.now()
    setPhase('review')
  }

  const handleKnowIt = async () => {
    const word = session?.words[currentIndex]
    if (!word) return
    await updateWordProgress(word.id, 4, user?.id || 'guest', null)
    setCorrectCount((prev) => prev + 1)
    advanceWord()
  }

  const handleDontKnow = async () => {
    const word = session?.words[currentIndex]
    if (!word) return
    await updateWordProgress(word.id, 1, user?.id || 'guest', null)
    advanceWord()
  }

  const advanceWord = () => {
    setShowAnswer(false)
    if (currentIndex < (session?.words.length || 0) - 1) {
      setReviewedCount((prev) => prev + 1)
      setCurrentIndex((prev) => prev + 1)
    } else {
      endSession()
    }
  }

  const endSession = () => {
    setPhase('results')
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const total = reviewedCount + 1
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
    recordStudySession(user?.id || 'guest', 'flashcard', total, accuracy, duration)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent" />
        <p className="text-sm text-ink-500 dark:text-ink-400">Analyzing your learning patterns...</p>
      </div>
    )
  }

  const currentWord = session?.words[currentIndex]

  // Setup Phase
  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <SEO {...PAGE_SEO['smart-review']} />
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
              boxShadow: '0 8px 25px rgba(139,92,246,0.35)',
            }}
          >
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">AI Smart Review</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-2 text-sm">
            Personalized review session based on your error patterns and weak areas
          </p>
        </div>

        {session && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card space-y-4"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed">{session.explanation}</p>
              </div>
            </div>

            {session.focusAreas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2">Focus Areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {session.focusAreas.map((area, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-purple-50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-700/30 text-purple-700 dark:text-purple-300"
                    >
                      <Star className="w-3 h-3" />
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-ink-100/50 dark:border-white/5">
              <span className="text-sm text-ink-500 dark:text-ink-400">
                {session.words.length} words to review
              </span>
              <button
                onClick={startReview}
                disabled={session.words.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
                }}
              >
                Start Review <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {session?.words.length === 0 && (
          <div className="card text-center py-8">
            <p className="text-ink-500 dark:text-ink-400">No words need review right now. Great job!</p>
            <button
              onClick={() => navigate('/learn')}
              className="mt-4 btn-secondary"
            >
              Back to Learn
            </button>
          </div>
        )}
      </div>
    )
  }

  // Results Phase
  if (phase === 'results') {
    const total = reviewedCount + 1
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div
          className="card text-center py-8 space-y-4"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(236,72,153,0.06) 100%)',
          }}
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
              boxShadow: '0 8px 25px rgba(139,92,246,0.35)',
            }}
          >
            <Brain className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-ink-900 dark:text-white">Review Complete!</h2>

          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="text-center">
              <p className="text-2xl font-bold gradient-text">{correctCount}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Known</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-ink-900 dark:text-white">{total - correctCount}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Need Review</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-ink-900 dark:text-white">{accuracy}%</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Accuracy</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-ink-500 dark:text-ink-400">
            <span>
              Time: {minutes > 0 ? `${minutes}m ` : ''}
              {seconds}s
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setPhase('setup')
              setCorrectCount(0)
              setReviewedCount(0)
            }}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Review Again
          </button>
          <button
            onClick={() => navigate('/learn')}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            Back to Learn
          </button>
        </div>
      </div>
    )
  }

  // Review Phase
  if (!currentWord) return null

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold text-ink-700 dark:text-ink-300">
          AI Smart Review
          <span className="text-ink-500 dark:text-ink-400 font-normal ml-2">
            • Word {currentIndex + 1}/{session?.words.length}
          </span>
        </p>
        <button
          onClick={() => navigate('/learn')}
          className="p-2 rounded-xl text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-white/30 dark:hover:bg-white/10 transition-all"
          aria-label="Exit mode"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="h-2 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden backdrop-blur">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)' }}
          animate={{ width: `${((currentIndex + 1) / (session?.words.length || 1)) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentWord.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div
            className="card text-center py-8 cursor-pointer"
            onClick={() => setShowAnswer(!showAnswer)}
          >
            <p className="text-6xl sm:text-7xl font-bold text-ink-900 dark:text-white chinese-text">
              {currentWord.chinese}
            </p>
            {showAnswer ? (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-1"
              >
                <p className="text-xl font-semibold text-teal-600 dark:text-teal-400">
                  {currentWord.pinyin}
                </p>
                <p className="text-base text-ink-600 dark:text-ink-300">
                  {currentWord.english}
                </p>
                {Array.isArray(currentWord.pos) && currentWord.pos.length > 0 && (
                  <div className="flex justify-center gap-1.5 mt-2">
                    {currentWord.pos.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded-md bg-ink-100/50 dark:bg-white/10 text-xs text-ink-500 dark:text-ink-400">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="mt-4 text-sm text-ink-400 dark:text-ink-500">
                Tap to reveal answer
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDontKnow}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 4px 15px rgba(239,68,68,0.3)',
              }}
            >
              <X className="w-4 h-4" /> Still Learning
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleKnowIt}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
              }}
            >
              <Check className="w-4 h-4" /> I Know It
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}