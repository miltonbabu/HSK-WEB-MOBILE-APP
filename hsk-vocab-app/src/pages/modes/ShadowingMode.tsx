import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Volume2, Check, X, RotateCcw } from 'lucide-react'
import { useAuthStore, useProgressStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, UserProgress, HSKLevel } from '@/types'
import { updateWordProgress, recordStudySession } from '@/utils/study-helpers'

const WORD_COUNTS = [5, 10, 15, 20]
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5]
const HSK_LEVELS: (HSKLevel | 'all')[] = [1, 2, 3, 4, 'all']

type Phase = 'setup' | 'practice' | 'results'
type Assessment = 'perfect' | 'good' | 'needs_work'

interface WordResult {
  word: Word
  assessment: Assessment
  quality: number
}

const ASSESSMENT_CONFIG: Record<Assessment, { label: string; quality: number; color: string; bg: string }> = {
  perfect: { label: 'Perfect', quality: 5, color: '#10b981', bg: 'bg-green-500' },
  good: { label: 'Good', quality: 3, color: '#f59e0b', bg: 'bg-amber-500' },
  needs_work: { label: 'Needs Work', quality: 1, color: '#ef4444', bg: 'bg-red-500' },
}

export default function ShadowingMode() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()

  const [allWords, setAllWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const [loading, setLoading] = useState(true)

  // Setup state
  const [hskLevel, setHskLevel] = useState<HSKLevel | 'all'>(selectedLevel)
  const [wordCount, setWordCount] = useState(10)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)

  // Practice state
  const [phase, setPhase] = useState<Phase>('setup')
  const [sessionWords, setSessionWords] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showAssessment, setShowAssessment] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [results, setResults] = useState<WordResult[]>([])

  const sessionStartRef = useRef(Date.now())
  const sessionRecordedRef = useRef(false)

  useEffect(() => {
    async function loadData() {
      try {
        const words = await wordService.getAll()
        setAllWords(words)
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')
        setProgress(new Map(userProgress.map((p) => [p.word_id, p])))
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  // Record session on unmount
  useEffect(() => {
    return () => {
      if (results.length > 0 && !sessionRecordedRef.current) {
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        const correctCount = results.filter((r) => r.assessment !== 'needs_work').length
        const accuracy = Math.round((correctCount / results.length) * 100)
        recordStudySession(user?.id || 'guest', 'shadowing', results.length, accuracy, duration)
        sessionRecordedRef.current = true
      }
    }
  }, [results])

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const speakWord = useCallback((word: Word) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word.chinese)
    utterance.lang = 'zh-CN'
    utterance.rate = playbackSpeed
    utterance.pitch = 1
    utterance.onend = () => setIsPlaying(false)
    utterance.onerror = () => setIsPlaying(false)
    setIsPlaying(true)
    window.speechSynthesis.speak(utterance)
  }, [playbackSpeed])

  const currentWord = sessionWords[currentIndex]

  // Auto-play audio when new word appears during practice
  useEffect(() => {
    if (phase === 'practice' && currentWord) {
      const timer = setTimeout(() => speakWord(currentWord), 300)
      return () => clearTimeout(timer)
    }
  }, [phase, currentIndex, currentWord, speakWord])

  const startSession = () => {
    const filtered = hskLevel === 'all'
      ? allWords
      : allWords.filter((w) => w.hsk_level === hskLevel)
    const shuffled = shuffleArray(filtered)
    const selected = shuffled.slice(0, Math.min(wordCount, shuffled.length))

    if (selected.length === 0) return

    setSessionWords(selected)
    setCurrentIndex(0)
    setResults([])
    setShowAssessment(false)
    setShowEnglish(false)
    sessionStartRef.current = Date.now()
    sessionRecordedRef.current = false
    setPhase('practice')
  }

  const handleReady = () => {
    setShowAssessment(true)
  }

  const handleAssessment = async (assessment: Assessment) => {
    if (!currentWord) return

    const config = ASSESSMENT_CONFIG[assessment]
    const userId = user?.id || 'guest'
    const existingProgress = progress.get(currentWord.id)

    await updateWordProgress(currentWord.id, config.quality as 0 | 1 | 2 | 3 | 4 | 5, userId, existingProgress || null)

    const result: WordResult = { word: currentWord, assessment, quality: config.quality }
    setResults((prev) => [...prev, result])
    setShowEnglish(true)
  }

  const handleNext = () => {
    if (currentIndex < sessionWords.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setShowAssessment(false)
      setShowEnglish(false)
    } else {
      // Session complete — record and show results
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
      const allResults = [...results]
      const correctCount = allResults.filter((r) => r.assessment !== 'needs_work').length
      const accuracy = allResults.length > 0 ? Math.round((correctCount / allResults.length) * 100) : 0
      recordStudySession(user?.id || 'guest', 'shadowing', allResults.length, accuracy, duration)
      sessionRecordedRef.current = true
      setPhase('results')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-teal-500 border-t-transparent" />
      </div>
    )
  }

  // ─── SETUP PHASE ───────────────────────────────────────────
  if (phase === 'setup') {
    const filteredCount = hskLevel === 'all'
      ? allWords.length
      : allWords.filter((w) => w.hsk_level === hskLevel).length

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              boxShadow: '0 8px 25px rgba(20,184,166,0.35)',
            }}
          >
            <Mic className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Shadowing</h1>
          <p className="text-ink-500 dark:text-ink-400 mt-2">
            Practice pronunciation by listening and repeating aloud
          </p>
        </div>

        <div className="card space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">HSK Level</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {HSK_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setHskLevel(level)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    hskLevel === level ? 'pill-active' : 'pill-inactive'
                  }`}
                >
                  {level === 'all' ? 'All' : `HSK ${level}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Number of Words</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {WORD_COUNTS.map((count) => (
                <button
                  key={count}
                  onClick={() => setWordCount(count)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    wordCount === count ? 'pill-active' : 'pill-inactive'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Playback Speed</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    playbackSpeed === speed ? 'pill-active' : 'pill-inactive'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-ink-500 dark:text-ink-400">
            <span>{Math.min(wordCount, filteredCount)} words</span>
            <span>•</span>
            <span>{playbackSpeed}x speed</span>
          </div>

          <button
            onClick={startSession}
            disabled={filteredCount === 0}
            className="btn-primary w-full py-3 text-lg"
            style={{
              background: filteredCount === 0 ? undefined : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              boxShadow: filteredCount === 0 ? undefined : '0 4px 15px rgba(20,184,166,0.4)',
            }}
          >
            Start Shadowing
          </button>
        </div>
      </div>
    )
  }

  // ─── RESULTS PHASE ─────────────────────────────────────────
  if (phase === 'results') {
    const perfectCount = results.filter((r) => r.assessment === 'perfect').length
    const goodCount = results.filter((r) => r.assessment === 'good').length
    const needsWorkCount = results.filter((r) => r.assessment === 'needs_work').length
    const accuracy = results.length > 0
      ? Math.round(((perfectCount + goodCount) / results.length) * 100)
      : 0
    const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const minutes = Math.floor(durationSeconds / 60)
    const seconds = durationSeconds % 60

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div
          className="card text-center py-8 space-y-4"
          style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(13,148,136,0.08) 100%)' }}
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              boxShadow: '0 8px 25px rgba(20,184,166,0.35)',
            }}
          >
            <Mic className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-ink-900 dark:text-white">Session Complete!</h2>

          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{perfectCount}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Perfect</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{goodCount}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Good</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{needsWorkCount}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Needs Work</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-ink-500 dark:text-ink-400">
            <span>
              Accuracy: <span className="font-bold text-ink-900 dark:text-white">{accuracy}%</span>
            </span>
            <span>
              Time: <span className="font-bold text-ink-900 dark:text-white">{minutes > 0 ? `${minutes}m ` : ''}{seconds}s</span>
            </span>
          </div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Word Review</h3>
          <div className="max-h-60 overflow-y-auto scrollbar-hide space-y-2">
            {results.map((r, i) => {
              const config = ASSESSMENT_CONFIG[r.assessment]
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-xl"
                  style={{ background: `${config.color}10` }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: config.color }}
                  >
                    {r.assessment === 'perfect' ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : r.assessment === 'good' ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : (
                      <X className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-ink-900 dark:text-white chinese-text">
                    {r.word.chinese}
                  </span>
                  <span className="text-xs text-ink-500 dark:text-ink-400 truncate flex-1">
                    {r.word.english}
                  </span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full text-white shrink-0"
                    style={{ backgroundColor: config.color }}
                  >
                    {config.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setPhase('setup')
              setResults([])
            }}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              boxShadow: '0 4px 15px rgba(20,184,166,0.4)',
            }}
          >
            <RotateCcw className="w-4 h-4" /> Try Again
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

  // ─── PRACTICE PHASE ────────────────────────────────────────
  if (!currentWord) return null

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold text-ink-700 dark:text-ink-300">
          Shadowing
          <span className="text-ink-500 dark:text-ink-400 font-normal ml-2">
            • Word {currentIndex + 1}/{sessionWords.length}
          </span>
        </p>
        <div className="text-right">
          <p className="text-[10px] text-ink-500 dark:text-ink-400">Speed</p>
          <p className="text-sm font-semibold" style={{ color: '#14b8a6' }}>
            {playbackSpeed}x
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden backdrop-blur">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${((currentIndex + 1) / sessionWords.length) * 100}%`,
            background: 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)',
          }}
        />
      </div>

      {/* Word card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentWord.id + '-' + currentIndex}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="card py-10"
        >
          <div className="text-center space-y-4">
            {/* Chinese character */}
            <p className="text-6xl sm:text-7xl font-bold text-ink-900 dark:text-white chinese-text">
              {currentWord.chinese}
            </p>

            {/* Pinyin reference */}
            <p className="text-2xl text-ink-500 dark:text-ink-400">{currentWord.pinyin}</p>

            {/* Play button */}
            <button
              onClick={() => speakWord(currentWord)}
              disabled={isPlaying}
              className="w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                boxShadow: '0 6px 20px rgba(20,184,166,0.4)',
              }}
            >
              <Volume2 className="w-7 h-7 text-white" />
            </button>

            {/* English meaning (shown after assessment) */}
            <AnimatePresence>
              {showEnglish && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="pt-2"
                >
                  <p className="text-lg text-ink-700 dark:text-ink-300">{currentWord.english}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Action buttons */}
      <AnimatePresence mode="wait">
        {!showAssessment ? (
          <motion.button
            key="ready"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleReady}
            className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base"
            style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              boxShadow: '0 4px 15px rgba(20,184,166,0.4)',
            }}
          >
            <Mic className="w-5 h-5" /> I'm Ready
          </motion.button>
        ) : !showEnglish ? (
          <motion.div
            key="assessment"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-3 gap-3"
          >
            {(['perfect', 'good', 'needs_work'] as Assessment[]).map((assessment) => {
              const config = ASSESSMENT_CONFIG[assessment]
              return (
                <button
                  key={assessment}
                  onClick={() => handleAssessment(assessment)}
                  className="py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-105"
                  style={{
                    backgroundColor: config.color,
                    boxShadow: `0 4px 15px ${config.color}55`,
                  }}
                >
                  {assessment === 'perfect' && <Check className="w-4 h-4 mx-auto mb-1" />}
                  {assessment === 'needs_work' && <X className="w-4 h-4 mx-auto mb-1" />}
                  {assessment === 'good' && <Check className="w-4 h-4 mx-auto mb-1" />}
                  {config.label}
                </button>
              )
            })}
          </motion.div>
        ) : (
          <motion.button
            key="next"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleNext}
            className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base"
            style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              boxShadow: '0 4px 15px rgba(20,184,166,0.4)',
            }}
          >
            {currentIndex < sessionWords.length - 1 ? 'Next Word' : 'See Results'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
