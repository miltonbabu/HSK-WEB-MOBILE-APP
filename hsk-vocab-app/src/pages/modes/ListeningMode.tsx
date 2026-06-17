import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore, useProgressStore, useSettingsStore } from '@/stores'
import { wordService, progressService } from '@/services/sqlite-api'
import { Word, UserProgress } from '@/types'
import { getToneColor, splitPinyinSyllables } from '@/utils/pinyin'
import { updateWordProgress, correctToQuality, recordStudySession } from '@/utils/study-helpers'

const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5]

export default function ListeningMode() {
  const { user } = useAuthStore()
  const { selectedLevel } = useProgressStore()
  const { playbackSpeed, setPlaybackSpeed } = useSettingsStore()
  const [words, setWords] = useState<Word[]>([])
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 })
  const [userGuess, setUserGuess] = useState('')
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)
  const sessionStartRef = useRef(Date.now())

  useEffect(() => {
    async function loadData() {
      try {
        const levelWords = await wordService.getByLevel(selectedLevel)
        setWords(levelWords)
        const userProgress = await progressService.getUserProgress(user?.id || 'guest')
        setProgress(new Map(userProgress.map((p) => [p.word_id, p])))
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id, selectedLevel])

  // Record session on unmount
  useEffect(() => {
    return () => {
      const userId = user?.id || 'guest'
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
      if (sessionStats.total > 0) {
        recordStudySession(userId, 'listening', sessionStats.total, Math.round((sessionStats.correct / sessionStats.total) * 100), duration)
      }
    }
  }, [])

  const currentWord = words[currentIndex]

  const speakWord = () => {
    if (!currentWord || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(currentWord.chinese)
    utterance.lang = 'zh-CN'
    utterance.rate = playbackSpeed
    utterance.pitch = 1
    utterance.onend = () => setIsPlaying(false)
    utterance.onerror = () => setIsPlaying(false)
    speechRef.current = utterance
    setIsPlaying(true)
    window.speechSynthesis.speak(utterance)
  }

  const handleReveal = () => {
    setShowAnswer(true)
    speakWord()
  }

  const handleAnswer = async (correct: boolean) => {
    setIsCorrect(correct)
    setSessionStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }))

    // Update SRS progress
    if (currentWord) {
      const userId = user?.id || 'guest'
      const quality = correctToQuality(correct)
      const existingProgress = progress.get(currentWord.id)
      await updateWordProgress(currentWord.id, quality, userId, existingProgress || null)
    }

    setTimeout(() => {
      setShowAnswer(false)
      setIsCorrect(null)
      setUserGuess('')
      if (currentIndex < words.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        setCurrentIndex(0)
      }
    }, 1500)
  }

  const checkGuess = () => {
    if (!userGuess.trim()) return
    const correct = userGuess.trim().toLowerCase() === currentWord.english.toLowerCase()
    handleAnswer(correct)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-6xl">🎧</span>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-4">No Words Available</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          No words found for HSK {selectedLevel}.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Compact meta row — no duplicate top nav bar, the global header
          already shows the page context. */}
      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold text-ink-700 dark:text-ink-300">
          Listening Practice
          <span className="text-ink-500 dark:text-ink-400 font-normal ml-2">
            • HSK {selectedLevel} • Word {currentIndex + 1}/{words.length}
          </span>
        </p>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-ink-500 dark:text-ink-400">Accuracy</p>
          <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
            {sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
        />
      </div>

      <motion.div
        key={currentWord.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card py-12"
      >
        <div className="text-center">
          {!showAnswer ? (
            <>
              <button
                onClick={speakWord}
                disabled={isPlaying}
                className="w-24 h-24 rounded-full bg-primary-500 text-white text-4xl flex items-center justify-center mx-auto hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {isPlaying ? '🔊' : '🔈'}
              </button>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Click to listen</p>

              <div className="mt-8">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Type the English meaning:</p>
                <input
                  type="text"
                  value={userGuess}
                  onChange={(e) => setUserGuess(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkGuess()}
                  className="input-field max-w-xs mx-auto text-center"
                  placeholder="Your answer..."
                />
                <div className="mt-4 flex justify-center gap-3">
                  <button onClick={handleReveal} className="btn-secondary">
                    Reveal Answer
                  </button>
                  <button onClick={checkGuess} className="btn-primary" disabled={!userGuess.trim()}>
                    Submit
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="text-6xl font-bold text-gray-900 dark:text-white chinese-text whitespace-nowrap">
                {currentWord.chinese}
              </span>
              <div className="mt-4 text-2xl">
                {splitPinyinSyllables(currentWord.pinyin).map(({ syllable, tone }, i) => (
                  <span key={i} className={getToneColor(tone)}>
                    {syllable}{i < currentWord.pinyin.split(' ').length - 1 ? ' ' : ''}
                  </span>
                ))}
              </div>
              <span className={`block mt-2 text-xl ${isCorrect === null ? 'text-gray-700 dark:text-gray-300' : isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {currentWord.english}
              </span>
              <span className="mt-2 text-sm text-gray-500 dark:text-gray-400">({Array.isArray(currentWord.pos) ? currentWord.pos.join(', ') : currentWord.pos})</span>

              {isCorrect !== null && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`mt-6 text-4xl ${isCorrect ? '🎉' : '😢'}`}
                />
              )}
            </>
          )}
        </div>
      </motion.div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Speed:</span>
          {PLAYBACK_SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                playbackSpeed === speed
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setShowAnswer(false)
            setIsCorrect(null)
            setUserGuess('')
            if (currentIndex < words.length - 1) {
              setCurrentIndex(currentIndex + 1)
            }
          }}
          className="btn-secondary"
        >
          Skip →
        </button>
      </div>

      <div className="card bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tone Guide</h3>
        <div className="flex justify-around text-center">
          {[
            { tone: 1, color: 'text-tone-1', label: '1st' },
            { tone: 2, color: 'text-tone-2', label: '2nd' },
            { tone: 3, color: 'text-tone-3', label: '3rd' },
            { tone: 4, color: 'text-tone-4', label: '4th' },
            { tone: 5, color: 'text-tone-5', label: 'Neutral' },
          ].map(({ tone, color, label }) => (
            <div key={tone}>
              <span className={`text-xl font-bold ${color}`}>ā</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
